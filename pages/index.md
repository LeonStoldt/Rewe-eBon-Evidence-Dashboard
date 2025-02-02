---
title: Rewe eBon Dashboard
---

```sql marketData
SELECT
    market AS marketId,
    JSON_EXTRACT_STRING(marketAddress::JSON, '$.street') AS street,
    JSON_EXTRACT_STRING(marketAddress::JSON, '$.zip') AS zip,
    JSON_EXTRACT_STRING(marketAddress::JSON, '$.city') AS city,
    COUNT(*) AS visited
FROM rewe_ebon_extractor
GROUP BY 1,2,3,4
```

```sql items
SELECT
    JSON_EXTRACT_STRING(item.value, '$.name') AS name,
    JSON_EXTRACT_STRING(item.value, '$.taxCategory') AS taxCategory,
    JSON_EXTRACT_STRING(item.value, '$.unit') AS unit,
    COALESCE(
        JSON_EXTRACT(item.value, '$.pricePerUnit')::FLOAT,
        ROUND(JSON_EXTRACT(item.value, '$.subTotal')::FLOAT / NULLIF(JSON_EXTRACT(item.value, '$.amount')::FLOAT, 0), 2)
    ) AS pricePerUnit,
    JSON_EXTRACT(item.value, '$.paybackQualified')::BOOL AS paybackQualified
FROM rewe_ebon_extractor, UNNEST(JSON_EXTRACT(items, '$[*]')) AS item(value)
```

```sql payback
SELECT
    date::TIMESTAMPTZ AS orderTime,
    JSON_EXTRACT_STRING(payback::JSON, '$.card') AS card,
    JSON_EXTRACT(payback::JSON, '$.pointsBefore')::INT AS pointsBefore,
    JSON_EXTRACT(payback::JSON, '$.earnedPoints')::INT AS earnedPoints,
    JSON_EXTRACT(payback::JSON, '$.basePoints')::INT AS basePoints,
    JSON_EXTRACT(payback::JSON, '$.couponPoints')::INT AS couponPoints,
    JSON_EXTRACT(payback::JSON, '$.qualifiedRevenue')::FLOAT AS qualifiedRevenue
FROM rewe_ebon_extractor
```

```sql payback_coupons
SELECT
    date::TIMESTAMPTZ AS orderTime,
    JSON_EXTRACT_STRING(payback::JSON, '$.card') AS card,
    JSON_EXTRACT_STRING(coupon.value, '$.name') AS couponName,
    JSON_EXTRACT(coupon.value, '$.points')::INT AS earnedPoints
FROM rewe_ebon_extractor, UNNEST(JSON_EXTRACT(payback, '$.usedCoupons[*]')) AS coupon(value)
```

```sql orderPositions
SELECT
    date::TIMESTAMPTZ AS orderTime,
    market AS marketId,
    JSON_EXTRACT_STRING(item.value, '$.name') AS itemName,
    JSON_EXTRACT(item.value, '$.amount')::FLOAT AS itemAmount,
    COALESCE(
        JSON_EXTRACT(item.value, '$.pricePerUnit')::FLOAT,
        ROUND(JSON_EXTRACT(item.value, '$.subTotal')::FLOAT / NULLIF(JSON_EXTRACT(item.value, '$.amount')::FLOAT, 0), 2)
    ) AS itemPricePerUnit,
    JSON_EXTRACT(item.value, '$.subTotal')::FLOAT AS itemSubTotal,
    total::FLOAT AS total,
FROM
    rewe_ebon_extractor,
    UNNEST(JSON_EXTRACT(items, '$[*]')) AS item(value)
```

---

```sql total_spent_by_month
SELECT 
    SUM(CASE 
        WHEN DATE_PART('month', orderTime::TIMESTAMP) = DATE_PART('month', CURRENT_DATE)
        THEN itemSubTotal
        ELSE 0
    END) AS currentMonthSpent,
    SUM(CASE 
        WHEN DATE_PART('month', orderTime::TIMESTAMP) = DATE_PART('month', CURRENT_DATE - INTERVAL '1 month')
        THEN itemSubTotal
        ELSE 0
    END) AS lastMonthSpent,
    SUM(CASE 
        WHEN DATE_PART('month', orderTime::TIMESTAMP) = DATE_PART('month', CURRENT_DATE - INTERVAL '2 month')
        THEN itemSubTotal
        ELSE 0
    END) AS lastMonthSpentComparison
FROM ${orderPositions}
WHERE orderTime >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '2 month';
```

```sql latest_order_position
SELECT MAX(orderTime) AS latestOrderPosition
FROM ${orderPositions}
```

<BigValue
title='Spent (current Month)'
data={total_spent_by_month}
value=currentMonthSpent
/>

<BigValue
title='Spent (Last Month)'
data={total_spent_by_month}
value=lastMonthSpent
comparison=lastMonthSpentComparison
comparisonTitle="vs. Month before"
downIsGood=true
/>

<BigValue
title='Most recent data'
data={latest_order_position}
value=latestOrderPosition
/>

---

<DateRange
name=date_range_filter
data={orderPositions}
dates=orderTime
defaultValue='Last 3 Months'
/>

## Per Order Spending Trends
Breakdown of spent money and items bought over selected time range.

```sql total_spent_by_time
SELECT orderTime, total AS spent, COUNT(itemAmount) AS items
FROM ${orderPositions}
WHERE orderTime BETWEEN '${inputs.date_range_filter.start}' AND '${inputs.date_range_filter.end}'
GROUP BY orderTime, total
```

```sql avg_spent_by_time
SELECT AVG(total) AS avgSpent
FROM (
    SELECT total
    FROM ${orderPositions}
    WHERE orderTime BETWEEN '${inputs.date_range_filter.start}' AND '${inputs.date_range_filter.end}'
    GROUP BY orderTime, total
)
```

<BarChart
data={total_spent_by_time}
x=orderTime
y=spent
y2=items
y2SeriesType=line
>
<ReferenceLine data={avg_spent_by_time} y=avgSpent label=avg/>
</BarChart>

---

## Monthly Spending Trends
Aggregated costs and items bought per month.

```sql total_spent_last_year_per_month
SELECT MONTHNAME(orderTime::TIMESTAMP) AS orderMonth, SUM(total) as spentPerMonth, SUM(itemAmountPerOrder) AS itemsBoughtPerMonth
FROM (
    SELECT orderTime, total, SUM(itemAmount) AS itemAmountPerOrder
    FROM ${orderPositions}
    WHERE orderTime BETWEEN '${inputs.date_range_filter.start}' AND '${inputs.date_range_filter.end}'
    GROUP BY orderTime, total
    ORDER BY orderTime ASC
)
GROUP BY MONTHNAME(orderTime::TIMESTAMP)
```

```sql avg_total_spent_last_year_per_month
SELECT AVG(spentPerMonth) AS avgMonthSpent FROM ${total_spent_last_year_per_month}
```

<BarChart
data={total_spent_last_year_per_month}
x=orderMonth
y=spentPerMonth
y2=itemsBoughtPerMonth
y2SeriesType=line
sort=false
>
<ReferenceLine data={avg_total_spent_last_year_per_month} y=avgMonthSpent label=avg/>
</BarChart>

---

## Monthly Spending Distribution
Analyze cost distribution per month.

```sql monthly_spending_for_boxplot
SELECT 
    MONTHNAME(orderTime::TIMESTAMP) AS orderMonth, 
    PERCENTILE_CONT(0.0) WITHIN GROUP (ORDER BY total) AS minSpent,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY total) AS q1Spent,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total) AS medianSpent,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY total) AS q3Spent,
    PERCENTILE_CONT(1.0) WITHIN GROUP (ORDER BY total) AS maxSpent
FROM (
    SELECT orderTime, total
    FROM ${orderPositions}
    WHERE orderTime BETWEEN '${inputs.date_range_filter.start}' AND '${inputs.date_range_filter.end}'
    GROUP BY orderTime, total
    ORDER BY orderTime ASC
)
GROUP BY MONTHNAME(orderTime::TIMESTAMP)
```

<BoxPlot
xAxisTitle='Month'
yAxisTitle='Costs'
data={monthly_spending_for_boxplot}
name=orderMonth
min=minSpent
intervalBottom=q1Spent
midpoint=medianSpent
intervalTop=q3Spent
max=maxSpent
sort=false
/>

---

## Top Items Purchased

Identify the most frequently purchased items.

```sql items_bought_frequency
SELECT itemName, SUM(itemAmount) AS amount
FROM ${orderPositions}
GROUP BY itemName
ORDER BY amount DESC
```

<DataTable data={items_bought_frequency} rows=10/>

---

## Top Markets visited

<DataTable data={marketData}/>