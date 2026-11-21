# notes — a digital garden

[中文](README.zh-CN.md) · **English**

A personal knowledge garden built with [Quartz 5](https://quartz.jzhao.xyz) and published at <https://notes.vasantlong.de5.net> (GitHub Pages, built by Actions).

This is not a blog: there is no timeline. Every page is an **entry** — one idea you can ask a question about on its own. Drafts stay in Obsidian; only finished notes are promoted into `content/`, and a note without `publish: true` does not exist on the site (it is not "hidden").

## Reading the garden

- The explorer on the left is the table of contents; folders are expanded by default.
- `Cmd/Ctrl+K` searches. Chinese matches from the start of a word only — a known limitation.
- Every entry carries tags; `/tags/` lists them all.
- The graph on the right shows two hops around the current entry; the icon in its corner opens the whole garden.

## Writing

Write in Obsidian, then promote the note: copy it into `content/` and give it `publish: true`, `title`, `description` (≤ 80 characters) and `date`. The whole procedure — what happens to unfinished notes, how to verify the result — is in [docs/content.md](docs/content.md).

## Contributing

Corrections and questions: <https://github.com/VasantLong/notes/issues>.
Working in this repository as an agent? Read [AGENTS.md](AGENTS.md) first.

## Documentation

| What                                               | Where                                                        |
| -------------------------------------------------- | ------------------------------------------------------------ |
| Vocabulary: entry, promotion, publish states       | [CONTEXT.md](CONTEXT.md)                                     |
| Writing and promoting content                      | [docs/content.md](docs/content.md)                           |
| Local setup, tests, CI, deploy, domain, rollback   | [docs/deploy.md](docs/deploy.md)                             |
| Known limitations and hard constraints             | [DEGRADATIONS.md](DEGRADATIONS.md)                           |
| Site spec: 39 stories, plugin contract, test seams | [.scratch/garden-site/spec.md](.scratch/garden-site/spec.md) |
| Implementation tickets                             | [.scratch/garden-site/issues/](.scratch/garden-site/issues)  |

## License

The **notes** are licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — reuse and adapt them, just credit VasantLong and link back. The **site code** follows the MIT license in [LICENSE.txt](LICENSE.txt). Details: </license>.
