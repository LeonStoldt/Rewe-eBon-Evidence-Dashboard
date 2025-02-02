# REWE eBon Evidence Dashboard

## What is it for?
REWE (German food retail company) provides a service called '[eBon](https://www.rewe.de/service/ebon/)', where customers can receive their receipts digitally.
These receipts can be downloaded in the [REWE user portal](https://shop.rewe.de/mydata/meine-einkaeufe/im-markt).
Currently, available formats are `pdf` and `csv`.
While `csv` sounds good for automatic processing, the file looks something like this:
```csv
"Datum","Uhrzeit","Gesamtsumme"
"01.02.2025","18:02:25","37,24"
```

Instead, the `pdf` file contains all data and [webD97](https://github.com/webD97) created a javascript library for parsing eBon pdf files into JSON ([rewe-ebon-parser](https://github.com/webD97/rewe-ebon-parser)).

For displaying the data in a dashboard, I went with evidence as it is easy to query data (using sql) and already provides lots of visualizations to analyzing your data.
Additionally, evidence provides a [JavaScript datasource](https://docs.evidence.dev/core-concepts/data-sources/javascript/) which can run arbitrary JavaScript code as a data source.
In order to create an MVP, I went with a small [script](./sources/rewe_ebon_extractor/rewe_ebon_extractor.js) for parsing my eBon pdf files into queryable data.   

## Long-term solution
In the long run, it makes more sense to query the data directly from the REWE api. First research results are:

1. Rewe Login token might be received via `curl 'https://account.rewe.de/realms/sso/login-actions/authenticate' --data-raw 'username=test%40test.de&password=test&rememberMe=on'`
2. `https://shop.rewe.de/api/receipts/` shows all receipts as overview with RSTP token (example which uses api: https://github.com/Craze1997/grocy-rewe-connect/blob/main/main.py)
3. `https://shop.rewe.de/api/receipts/<UUID>` shows complete receipt
4. a custom evidence datasource provider can be written including parameter handling for REWE login

## Related

- [Rewe eBon parser library](https://github.com/webD97/rewe-ebon-parser)
- [Grocy Rewe Connect](https://github.com/Craze1997/grocy-rewe-connect)
- [Evidence Home Page](https://www.evidence.dev)
- [Evidence Docs](https://docs.evidence.dev)
- [DuckDB Docs](https://duckdb.org/docs)
- [DuckDB JSON Functions](https://duckdb.org/docs/data/json/json_functions.html)
