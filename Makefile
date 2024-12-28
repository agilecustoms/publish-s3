.PHONY: test

# npm list --all - show dependency tree
# npm outdated - to check outdated packages
# npm update - to update package-lock.json
app0-install-deps:
	@npm install

app1-lint:
	@npm run lint

app1-lint-fix:
	@npm run lint:fix

app2-test:
	@npm run test

app3-build:
	@npm run build
