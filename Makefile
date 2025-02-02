install:
	npm install

generate-sources:
	npm run sources

build:
	npm run build

start: install generate-sources
	npm run dev
