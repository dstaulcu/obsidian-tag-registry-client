# Requirements: Tag pages

## Introduction
A **tag page** is an ordinary note whose `aliases` front matter contains `#<tag>`. Tag Wrangler and the registry's own notes use this convention, so clicking a tag opens its page. Registry tags already get a page from the import (the registry note *is* the page). Tags people create locally (personal projects, people, ideas) have none, and Tag Wrangler's "Create tag page" drops one into Obsidian's default new-note folder with no definition.

This spec adds a command that creates the missing pages, in a folder the plugin controls, only for tags that have none.

## Glossary
- **Paged tag**: a tag that some note in the vault lists as a `#tag` alias, in any folder and any case.
- **Registry tag**: a tag any configured registry defines, whether or not its team is subscribed.
- **Conforming tag**: `<facet>/<name>`, both lowercase kebab-case, with a facet the registries list (any kebab-case facet when no registry is configured).

## Requirements

### R-TP-1 Tag page folder
1. THE SYSTEM SHALL keep a `tagPageFolder` setting, default `Tags/_local`.
2. THE SYSTEM SHALL reject a folder that fails `destError`, equals the destination folder, or sits inside it under a folder name a team or `core` could use (compared case-insensitively).

### R-TP-2 What gets a page
1. THE SYSTEM SHALL consider tags used by notes outside the destination and tag page folders, merging case variants.
2. THE SYSTEM SHALL skip a paged tag and a registry tag.
3. THE SYSTEM SHALL skip a non-conforming tag and count it as a grooming candidate.
4. WHEN registries are configured, THE SYSTEM SHALL load all of them first; IF any fails, THEN THE SYSTEM SHALL write nothing and say "No notes were changed".

### R-TP-3 Confirm, then create
1. WHEN pages are missing, THE SYSTEM SHALL list them with their use counts and the skip counts, and SHALL write nothing until the user presses Create.
2. WHEN nothing is missing, THE SYSTEM SHALL show a one-line notice with the skip counts and open no modal.
3. THE SYSTEM SHALL never overwrite or modify an existing note; a note already at a page's path is skipped and counted.
4. THE SYSTEM SHALL write only inside the tag page folder, at `<folder>/<facet>/<name>.md`, creating parent folders.

### R-TP-4 Page content
1. THE SYSTEM SHALL write the registry note format: `tag`, `aliases: ["#<tag>"]`, `facet`, `status: proposed`, empty `replaced_by`, `owner: local`, a `# <tag>` heading and an empty `Definition:` line.
2. THE SYSTEM SHALL NOT stamp the page with `glossary_hash`, so imports never treat it as an imported note or an orphan.

### R-TP-5 Privacy
1. Notices and logs SHALL carry counts only, never tags, folders or vault paths (invariant 5).
