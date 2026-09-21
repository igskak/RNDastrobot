# Chart import formats

The existing import preview/confirm flow accepts one file at a time. It keeps
the source local date/time, coordinates and the effective UTC offset, then
recalculates the chart in Steliara. No charts are written during preview.

| Source | Upload | Scope |
| --- | --- | --- |
| ZET | `.zbs` | Text database records |
| Astro.com and other AAF exporters | `.aaf`, `.txt` | AAF `#A93`/`#B93` records |
| Solar Fire v6+ and Astro Gold | `.SFcht` | Direct version-3 chart collection |
| Solar Fire | `charts.txt` | Chart details from **Email All Charts → Text File** |
| Astrolog | `.as` | `@AI` chart-info (`/qb`, `/zi`) and `@AL` chart-list (`/qcl`) files |

`.txt` content is dispatched by structure: AAF records or Solar Fire chart
details. Arbitrary text, Astrolog scripts/settings and unknown binary variants
are rejected. AAF remains the easiest export path for Astrolog when available.

The `.SFcht` reader follows the observed 86-byte header and version-3 record
layout, including Solar Fire's west-positive longitude and zone conventions.
It accepts only structurally complete files. Subsidiary charts inside a main
record are **not** created as separate charts; the preview warns about them.
Source house/zodiac/coordinate settings are not imported; sidereal or
heliocentric source settings produce a warning. Dates before 15 October 1582
in these new formats are rejected per record because they do not state the
calendar convention. The parsers currently have synthetic-fixture and API
coverage; sample files exported by several real application versions should
be added to the acceptance corpus before broad compatibility claims.

Sources for the formats and export paths:

- [Astro Gold import/export guide](https://www.astrogold.io/AG-Android-Help/import_export.html)
- [Solar Fire 9 user guide](https://alabe.com/ProgramDocs/SolarFire_v9.pdf), sections 7.3 and 9.10
- [Astrolog 8 documentation](https://www.astrolog.org/ftp/astrolog.htm), chart info/list and Solar Fire text import
- [Astrogram `.SFcht` parser layout](https://docs.rs/astrogram/latest/src/astrogram/sfcht.rs.html), reverse-engineered and tested against 22 specimen files
