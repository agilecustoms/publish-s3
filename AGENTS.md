# AGENTS.md

## Changes

The action is public, its only known consumer is *release*: it pins an exact version
(`agilecustoms/publish-s3@v{version}` in its `action.yml`),
so a new version reaches users only after the pin is bumped on *release* repo
