# npm list --all - show dependency tree
deps-install:
	@npm install

deps-update:
	@npm update; npm install; npm outdated; npm find-dupes --ignore-scripts

# eslint, then type check (tsc)
# fix: npm run lint -- --fix
lint:
	@npm run lint && npm run typecheck

test-app:
	@npm run test

# LocalStack via testcontainers (Docker), coverage is measured here
test-it:
	@npm run test-integration

build:
	@npm run build
