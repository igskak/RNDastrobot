# Mobile UI Audit

## Scope

Page-by-page mobile UX review for the AstroBot frontend.

Current approach:
- Review the real HTML/CSS/JS structure first.
- Log the main mobile issues and concrete improvement proposals.
- Move through the funnel in order, one page at a time.

Note:
- This first pass is a structural UI/UX audit based on the current frontend implementation.
- It is grounded in code review, not yet in live device screenshots.

## 1. `index.html` — mobile audit complete

Role in product:
- First impression.
- The main chart creation form.
- A key conversion step because the user invests effort before seeing value.

Files reviewed:
- `swisseph/app/frontend/index.html`
- `swisseph/app/frontend/css/styles.css`
- `swisseph/app/frontend/js/form.js`
- `swisseph/app/frontend/js/place-autocomplete.js`

### Main mobile issues

1. The form relies on several horizontal input groups without page-specific mobile breakpoints.
   Evidence:
   - Two-column name row in `index.html`.
   - Three-part date row in `index.html`.
   - Two-field time row with separator in `index.html`.
   - Matching flex layouts in `styles.css`.
   Impact:
   - On 320-390 px screens the inputs become visually cramped.
   - Scanning becomes harder because the eye has to zig-zag across narrow fields.
   - Error recovery is slower because the user must parse multiple tiny controls per row.

2. The coordinates block is always visible and feels too technical for the primary mobile path.
   Evidence:
   - Full DMS input block is rendered directly under place search in `index.html`.
   - It contains two dense inline coordinate rows in `styles.css`.
   Impact:
   - It increases perceived complexity right in the middle of the form.
   - It adds vertical bulk before the timezone and house system fields.
   - It weakens trust for non-expert users because the screen starts to feel like a technical tool instead of a guided product.

3. The form lacks step hierarchy and mobile progress cues.
   Evidence:
   - All fields are presented as one uninterrupted card in `index.html`.
   - There is no section grouping, mini-summary, or sticky action treatment.
   Impact:
   - On mobile the screen reads as a long wall of fields.
   - The user does not get a sense of momentum or completion.
   - The primary action is too far from the early high-intent inputs.

4. The place autocomplete dropdown is functional but not fully mobile-optimized.
   Evidence:
   - Suggestions are an absolute dropdown under the field in `styles.css`.
   - The interaction styling emphasizes hover, not touch selection states.
   - The result label can be long in `place-autocomplete.js`.
   Impact:
   - Long place names can feel crowded on narrow screens.
   - Touch feedback is weaker than it should be.
   - The dropdown can visually blend into the surrounding form instead of feeling like a strong selection layer.

5. The visual rhythm is calm, but the mobile spacing is still too card-centric and desktop-ish.
   Evidence:
   - The form uses a single padded card with 28x24 spacing in `styles.css`.
   - The container width is capped, but there are no dedicated adjustments for smaller phones.
   Impact:
   - The screen looks premium, but not yet purpose-built for one-handed completion.
   - Large card padding plus grouped inline inputs reduce the usable width of controls.

6. The timezone and house system fields appear after the most cognitively heavy section instead of supporting the user progressively.
   Impact:
   - The form asks for technical certainty late in the flow, after already spending effort on location and coordinates.
   - Mobile users may feel they are still not "done" even after entering the core birth data.

### Improvement proposals

1. Rebuild the mobile form flow into clear sections:
   - Identity.
   - Birth date and time.
   - Place.
   - Advanced settings.
   This will turn the screen from one long form into a guided sequence.

2. Add page-specific mobile breakpoints for `index` instead of relying on generic shared CSS only.
   Proposed behavior under 768 px:
   - Stack first name and last name vertically.
   - Stack day, month, and year into two rows or use a more deliberate grid with a wider month field.
   - Keep time inputs compact but increase tap comfort and spacing.
   Proposed behavior under 480 px:
   - Reduce card padding.
   - Increase vertical separation between groups.
   - Use larger tap targets and clearer field grouping.

3. Move coordinates into an explicit "Advanced" disclosure block.
   Proposed UX:
   - Default path: city search plus auto-detected timezone.
   - Secondary path: "Enter coordinates manually" accordion.
   This keeps expert control while removing fear and clutter from the primary mobile journey.

4. Strengthen the place-selection experience for touch screens.
   Proposed UX:
   - Increase suggestion row height.
   - Add stronger active and pressed states.
   - Show place name plus supporting secondary text if available.
   - Consider locking the timezone hint directly below the place field so the user sees immediate progress after selection.

5. Introduce a compact section summary near the CTA.
   Example:
   - Birth data complete.
   - Location selected.
   - Timezone confirmed.
   This gives mobile users reassurance before they submit.

6. Reposition advanced astrology choices below a clearer divider.
   House system should visually read as optional expertise tuning, not as part of the basic required path.

7. Make the submit area feel more decisive on mobile.
   Proposed UX:
   - Keep the main CTA visually anchored with more breathing room above it.
   - Add a short reassurance line near the button about what happens next, for example that the chart opens immediately after calculation.

### Priority

Highest-value changes for `index`:
- Add mobile-specific breakpoints for grouped fields.
- Hide coordinates behind an advanced disclosure.
- Restructure the form into guided sections.

### Next page

Next planned audit target:
- `login.html`

## 2. `login.html` — mobile audit complete

Role in product:
- Trust gate before entry.
- Sign-in, registration, verification, password recovery.
- A high-friction screen because it combines many states in one shell.

Files reviewed:
- `swisseph/app/frontend/login.html`
- `swisseph/app/frontend/entries-css/login.entry.css`
- `swisseph/app/frontend/js/login.js`

### Main mobile issues

1. The mobile layout hides the left story panel completely under 560 px, but the remaining auth card does not fully replace the lost trust context.
   Evidence:
   - The story section is removed at the smallest breakpoint in `login.entry.css`.
   - The main card then becomes the only visible structure on the screen.
   Impact:
   - The screen becomes efficient, but also more generic and less reassuring.
   - Users lose product framing exactly where they need confidence most.
   - The transition from rich desktop narrative to pure form feels abrupt rather than intentionally re-prioritized.

2. The page contains too many auth states in one container without a stronger mobile state hierarchy.
   Evidence:
   - `login.html` includes login, register, verify, resend, forgot, reset, success, and invalid flows in one card.
   - `login.js` swaps views dynamically inside the same shell.
   Impact:
   - On mobile, the same frame must support very different tasks with limited orientation cues.
   - Users can feel “stuck inside a modal” rather than moving through a clear flow.
   - Recovery states and informational states visually read too similarly to form states.

3. The registration and recovery flows are vertically heavy on small screens.
   Evidence:
   - Multiple full-height forms and stacked messages are placed inside the same card in `login.html`.
   - The card is forced to `min-height: calc(100vh - 20px)` on the smallest breakpoint in `login.entry.css`.
   Impact:
   - On phones with dynamic browser chrome or smaller keyboards, the card can feel oversized and slightly trapped inside the viewport.
   - Long auth states risk pushing key actions below the fold during keyboard use.
   - The user may need too much scrolling within what should feel like a quick transaction.

4. The mobile screen still carries decorative card framing that adds polish but not enough functional clarity.
   Evidence:
   - The auth card keeps frame and orbital decoration even in the smallest layout.
   Impact:
   - The screen looks premium, but some visual energy is still spent on ornament after the narrative panel is removed.
   - The remaining space could work harder for task clarity, trust signals, or status feedback.

5. Secondary actions compete with primary completion in a few mobile moments.
   Evidence:
   - Login includes Google sign-in, divider, password form, forgot password, and register CTA in a single initial view.
   - Several states also pair primary buttons with text-link exits and back actions.
   Impact:
   - The initial screen asks the user to evaluate too many branches at once.
   - The eye does not always land on one clearly dominant next step.
   - For smaller devices, the cognitive load is higher than necessary.

6. Informational states are well implemented, but not differentiated enough from action states on mobile.
   Evidence:
   - Check-email, verify-success, invalid-link, and reset-success views use the same shell and similar spacing system.
   Impact:
   - Success and waiting states do not feel distinct enough from input-heavy states.
   - Mobile users benefit from stronger emotional transitions: “action needed”, “check your inbox”, “done”, “link expired”.

7. Some field-level mobile behaviors are solid, but the page still feels slightly too dense during keyboard interaction.
   Evidence:
   - Inputs are correctly large and the two-column name grid collapses to one column under 720 px.
   - However, label rows, password toggles, inline links, error text, hints, and multiple stack-actions all remain inside one condensed card.
   Impact:
   - The form is usable, but not yet effortless.
   - On mobile keyboards, the visible working area becomes cramped quickly.

### Improvement proposals

1. Replace the hidden story panel on small screens with a compact trust header inside the card.
   Proposed UX:
   - Short premium value line.
   - 2-3 compact trust badges.
   - One sentence explaining why creating an account matters.
   This preserves reassurance without restoring the full desktop hero.

2. Give each auth state a clearer mobile identity.
   Proposed UX:
   - Form states: standard header plus fields.
   - Check-email and success states: centered confirmation layout with stronger iconography or status treatment.
   - Invalid-link states: clearer warning framing and one obvious recovery action.

3. Reduce “single giant card” pressure on phones.
   Proposed UX:
   - Remove forced near-full-screen card behavior on the smallest breakpoint.
   - Let the card size itself to content with healthy page padding.
   - Optimize for keyboard-safe flow rather than decorative full-height presence.

4. Simplify the first mobile login view around one primary path.
   Recommended priority:
   - Email login as primary.
   - Google sign-in as alternative, but visually separated with less competition.
   - Registration CTA framed as the next decision after the login action block.

5. Make registration feel like a guided continuation, not just another swapped state.
   Proposed UX:
   - Add a stronger subheading or progress cue when the user enters register view.
   - Surface password requirements more supportively before validation errors appear.
   - Keep the return-to-login control clearly visible but quieter than the primary action.

6. Rework mobile spacing for keyboard-heavy moments.
   Proposed UX:
   - Slightly tighter decorative spacing at the top.
   - More deliberate spacing between form groups and status blocks.
   - Keep the primary button closer to the active input sequence so the user does not have to hunt for it after keyboard dismissal.

7. Strengthen the emotional clarity of email-check and success screens.
   Proposed UX:
   - Larger message block.
   - Strong single next action.
   - Clear expectation text such as what email to check and what to do if nothing arrives.

### Priority

Highest-value changes for `login`:
- Add a compact mobile trust header after the story panel disappears.
- Reduce auth-state ambiguity inside the shared card.
- Rebalance primary and secondary actions on the first mobile screen.

### Next page

Next planned audit target:
- `clients.html`

## 3. `clients.html` — mobile audit complete

Role in product:
- Main astrologer workspace.
- Client list, search, sorting, and entry into saved charts.
- Operational screen where speed and clarity matter more than storytelling.

Files reviewed:
- `swisseph/app/frontend/clients.html`
- `swisseph/app/frontend/entries-css/clients.entry.css`
- `swisseph/app/frontend/js/clients.js`

### Main mobile issues

1. The screen is trying to be both a welcome surface and a dense work surface at the same time.
   Evidence:
   - The page includes a large hero, a side value panel, stats, toolbar, table, and edit dialog in one flow.
   - The first-visit vs returning-user hero reorder is handled in `clients.js`, which confirms that the page already has conflicting priorities.
   Impact:
   - On mobile the hierarchy is unstable: is this a dashboard, a landing section, or a quick client index?
   - First-time users get a large narrative block before reaching the list.
   - Returning users still carry a lot of visual mass around the hero even after reordering.

2. The above-the-fold area is too tall for a work screen on mobile.
   Evidence:
   - Header with profile pill and logout.
   - Large hero block with headline, badges, and aside in `clients.html`.
   - Stats and primary CTA above the actual list.
   Impact:
   - The user has to scroll through too much framing before reaching the practical task area.
   - The workspace feels editorial before it feels operational.
   - Frequent users will experience this as friction, not value.

3. The client table converts to stacked rows on mobile, but the interaction model stays ambiguous.
   Evidence:
   - Under 900 px the table becomes block rows with `td::before` labels in `clients.entry.css`.
   - The whole row remains clickable in `clients.js`.
   - The actions menu is also always visible on mobile because the button opacity is forced on.
   Impact:
   - It is not fully clear whether tapping a row opens a chart or whether the row is just informational.
   - The presence of a visible kebab action and a clickable row creates competing tap targets.
   - Accidental openings are more likely on touch devices.

4. The mobile list layout still behaves like a transformed table rather than a purpose-built card list.
   Evidence:
   - The mobile mode keeps table semantics and reflows cells into label-value rows.
   Impact:
   - Long place names, long dates, and action controls compete for horizontal space.
   - The information reads as converted desktop data, not as mobile-first client cards.
   - Scan speed is lower than it could be for an astrologer reviewing multiple clients.

5. The search and sort controls are acceptable responsively, but they are not optimized for fast mobile workspace use.
   Evidence:
   - Toolbar stacks into one column on smaller screens.
   - Search and sort live above the results area with no sticky treatment.
   Impact:
   - On longer client lists, returning to filters requires unnecessary scrolling.
   - The tools are present, but not especially efficient for repeated daily use.

6. The edit client dialog is visually polished but still desktop-modal in behavior.
   Evidence:
   - It is a centered modal with max-height constraints in `clients.entry.css`.
   - On smaller screens it becomes one column, but it still behaves like a floating dialog rather than a mobile-native editor.
   Impact:
   - On phones, editing can feel cramped and layered.
   - Keyboard interaction is likely to feel tight inside a scrollable modal.
   - This is especially noticeable because the edit form reuses compact grouped inputs from the birth form.

7. The edit form inherits the same horizontal mobile issues seen on `index`.
   Evidence:
   - Name, date, and time groups inside the dialog reuse `name-inputs`, `date-inputs`, and `time-inputs`.
   - Those shared form patterns were not redesigned specifically for the mobile dialog.
   Impact:
   - Even after the dialog grid collapses, several inputs remain packed into narrow horizontal rows.
   - Editing critical birth data on a phone is more fragile than it should be.

8. Header utility controls are functional, but they feel slightly crowded on smaller screens.
   Evidence:
   - Account identity pill and logout sit together in the header.
   - On narrower widths the header becomes column-based, but still keeps both elements visually heavy.
   Impact:
   - The top of the screen spends too much space on account chrome.
   - The practical workspace starts lower than necessary.

### Improvement proposals

1. Split the mobile experience into a clear “workspace first” hierarchy.
   Proposed UX:
   - Client list and primary actions first.
   - Hero content reduced to a compact collapsible summary or removed entirely for returning users on mobile.
   - Keep the screen focused on fast retrieval and action.

2. Replace the transformed mobile table with dedicated client cards.
   Proposed card structure:
   - Name and avatar/initials.
   - Key birth info.
   - Place.
   - Created or last updated.
   - One primary open action plus secondary menu.
   This would remove the awkward label-value table conversion.

3. Clarify row interactions.
   Recommended mobile behavior:
   - One obvious “Open chart” action on each card.
   - Secondary edit/delete menu separated clearly.
   - Avoid making the entire dense row tappable if the kebab menu stays visible.

4. Compress the top chrome on mobile.
   Proposed UX:
   - Smaller header footprint.
   - Account info reduced to a lighter compact line or menu.
   - Primary “New card” action placed closer to the search field or as a sticky mobile action.

5. Make search and sort feel like working tools, not passive controls.
   Proposed UX:
   - Sticky search bar or sticky tool row once the user scrolls.
   - Optional quick chips for common sort modes if usage supports it.
   - Keep result counts close to the filters.

6. Rebuild the edit flow as a mobile-first sheet or full-screen editor.
   Proposed UX:
   - Full-screen edit mode on phones.
   - Better keyboard accommodation.
   - Save/cancel actions anchored clearly at the bottom.

7. Apply the `index` mobile fixes inside the edit form too.
   Required changes:
   - Stack grouped fields vertically.
   - Reduce technical density.
   - Increase tap comfort for date/time editing.

### Priority

Highest-value changes for `clients`:
- Demote or compress hero content on mobile.
- Replace the transformed mobile table with true client cards.
- Make edit flow mobile-native instead of modal-desktop.

### Next page

Next planned audit target:
- `chart.html`

## 4. `chart.html` — mobile audit complete

Role in product:
- First high-value result screen after chart creation or client selection.
- Visual exploration surface for wheel, planets, aspects, houses, balances, and next-step navigation.
- A premium analysis screen where mobile clarity matters as much as visual polish.

Files reviewed:
- `swisseph/app/frontend/chart.html`
- `swisseph/app/frontend/entries-css/chart.entry.css`
- `swisseph/app/frontend/css/chart-layout.css`
- `swisseph/app/frontend/css/chat.css`
- `swisseph/app/frontend/js/chart.js`
- `swisseph/app/frontend/js/chart-layout.js`

### Main mobile issues

1. The page disables system pinch-zoom in the viewport.
   Evidence:
   - `chart.html` uses `maximum-scale=1.0, user-scalable=no`.
   Impact:
   - This is a major accessibility and usability regression on mobile.
   - Users cannot use their native browser zoom for dense labels, tables, or complex chart details.
   - The product is forcing a custom zoom model where native assistive behavior should still be allowed.

2. The screen has too many simultaneously competing overlays on mobile.
   Evidence:
   - Floating zoom controls.
   - Floating aspect legend.
   - Fixed bottom mobile nav.
   - Floating chat toggle and expandable chat widget.
   - Settings panel overlay.
   Impact:
   - The chart surface becomes visually crowded.
   - Important content near the bottom edges is pressured by controls.
   - The screen risks feeling like a stack of tools rather than one coherent reading experience.

3. Mobile view switching is structurally smart but still cognitively heavy.
   Evidence:
   - The layout swaps between planets, chart, and houses using full-screen views in `chart-layout.css`.
   - Mobile tabs switch entire surfaces in `chart-layout.js`.
   Impact:
   - This avoids cramped three-column compression, which is good.
   - But the user still has to mentally reconstruct one analysis from three separate rooms.
   - There is little summary glue between the views, so switching can feel disjointed.

4. The compact header is too dense for the amount of navigation and metadata it carries.
   Evidence:
   - Back control, client/date info, tables link, forecast link, and actions menu all live in one compact row in `chart.html`.
   Impact:
   - On mobile the header is efficient but crowded.
   - Client identity and analytical navigation compete for the same narrow strip.
   - It is easy for controls to feel compressed rather than confidently tappable.

5. Chart interactions rely on custom zoom/pan layers that are likely too complex on mobile.
   Evidence:
   - `chart.js` implements zoom and pinch behavior.
   - `chart-layout.js` also implements its own zoom and pan behavior for the same surface.
   Impact:
   - Even when this works, it introduces behavioral complexity on the most fragile input environment.
   - Duplicate interaction systems increase the chance of inconsistent transforms or jitter.
   - Mobile users benefit more from simpler, clearer interaction affordances than from multiple overlapping gesture systems.

6. The mobile chart view still lacks a clear “reading order”.
   Evidence:
   - Wheel, aspect filters, settings, zoom, and chat all remain highly interactive.
   - The screen emphasizes tooling more than guided interpretation.
   Impact:
   - Users can see a lot, but may not know what to look at first.
   - Expertise feels available, but not staged.
   - Beginners and even busy professionals may miss the most important signals in the chart.

7. Data views remain quite table-heavy on mobile.
   Evidence:
   - Planets, aspects, and houses stay in compact tables inside full-screen panels.
   Impact:
   - The panels are readable, but still optimized more for density than mobile scan comfort.
   - Important relationships are present, but not summarized.
   - Switching between panels is required to answer simple questions that could be surfaced faster.

8. The chat assistant is present, but its mobile integration is spatially expensive.
   Evidence:
   - Chat toggle floats above the mobile nav.
   - Expanded chat occupies a large fixed panel above the nav in `chat.css`.
   Impact:
   - The assistant is discoverable, which is good.
   - But on smaller devices it competes strongly with the chart itself.
   - It feels layered on top of the experience, not integrated into the chart workflow.

9. The edit-client dialog repeats the same mobile form issues seen on earlier screens.
   Evidence:
   - Name, date, and time fields still rely on horizontal grouped rows in the edit dialog.
   - The dialog becomes a bottom sheet on smaller widths, but the form pattern itself is not simplified.
   Impact:
   - Editing from the chart screen is possible, but not especially calm on phones.
   - The user is still asked to handle dense input geometry inside a constrained overlay.

### Improvement proposals

1. Remove the viewport restriction that disables native zoom.
   This is the highest-priority mobile accessibility fix for `chart`.

2. Reduce overlay competition on the chart view.
   Proposed mobile strategy:
   - Keep only one primary floating control cluster visible by default.
   - Collapse aspect filters into a bottom sheet, compact chip row, or settings tray.
   - Reassess whether zoom controls need to be permanently visible once pinch and reset are available.

3. Turn the chart mobile flow into a guided sequence rather than three separate silos.
   Proposed UX:
   - `Chart` view: wheel plus one short insight summary.
   - `Planets` view: top highlights before full list.
   - `Houses` view: strongest houses/configurations summary before tables.
   This will improve continuity between views.

4. Simplify the header for phones.
   Proposed UX:
   - Keep back plus compact identity line.
   - Move secondary navigation into a lighter overflow or segmented control.
   - Protect tap comfort and reduce label crowding.

5. Consolidate chart interaction logic.
   Recommendation:
   - Use one zoom/pan system, not parallel ones.
   - Preserve predictable gestures.
   - Reduce the chance that mobile interactions feel unstable or over-engineered.

6. Make the AI assistant more context-aware and less spatially dominant.
   Proposed UX:
   - Keep the entry point visible.
   - Let the assistant open in a stronger task mode, for example “Explain this chart” or “Summarize tensions”.
   - Consider a fuller, more intentional mobile sheet instead of a floating widget feeling bolted onto the corner.

7. Rebuild mobile data panels around summaries first, tables second.
   Example:
   - Strongest planets.
   - Dominant elements/modalities.
   - Key aspects to notice.
   Then let the tables provide full detail below.

8. Apply the earlier mobile form fixes to the edit sheet on this page too.

### Priority

Highest-value changes for `chart`:
- Re-enable native browser zoom.
- Reduce overlay clutter on the chart surface.
- Add summary-led mobile reading flow across chart, planets, and houses.

### Next page

Next planned audit target:
- `natal-full.html`

## 5. `natal-full.html` — mobile audit complete

Role in product:
- Dense analytical report.
- Reading-heavy premium screen for tables, houses, aspects, balances, and configurations.
- A screen where mobile usability depends on reading flow, not only on responsiveness.

Files reviewed:
- `swisseph/app/frontend/natal-full.html`
- `swisseph/app/frontend/css/natal-full.css`
- `swisseph/app/frontend/js/natal-full.js`

### Main mobile issues

1. The page is still fundamentally a desktop report that has been compressed, not re-authored for mobile reading.
   Evidence:
   - Large header plus summary bar plus legend panel.
   - Multiple wide data tables wrapped in horizontal scroll containers.
   - Two-column analytical section only collapses to one column responsively.
   Impact:
   - The mobile user still experiences the page as a reduced spreadsheet/report.
   - Reading effort is high because the information hierarchy is mostly inherited from desktop structure.
   - The screen is responsive, but not especially mobile-native.

2. Horizontal table scrolling remains a core interaction pattern.
   Evidence:
   - Planets table alone contains many columns in `natal-full.html`.
   - `.table-wrapper { overflow-x: auto; }` is used in `natal-full.css`.
   Impact:
   - On mobile, the user must pan tables laterally to understand a single row.
   - Comparison across columns is awkward.
   - This is one of the strongest indicators that the screen is not yet optimized for phone reading.

3. The top of the page contains too many orientation layers before the main reading begins.
   Evidence:
   - Sticky header.
   - Separate summary bar.
   - Expandable legend panel.
   Impact:
   - The page begins with useful context, but the stack is too tall for mobile.
   - Before the user reaches the report itself, they have already consumed a lot of chrome.
   - The report feels heavier and longer than necessary.

4. The summary bar helps, but it still behaves like a compact data strip rather than a true mobile summary.
   Evidence:
   - It surfaces ASC, MC, Sun, Moon, figure, and dominants.
   - On mobile it becomes a wrapped set of small blocks, not a guided insight card.
   Impact:
   - The user gets data, but not enough prioritization.
   - It is helpful for recall, less helpful for interpretation.
   - A mobile user would benefit more from “what matters first” than from multiple compressed indicators.

5. Section order is logical for experts, but not yet optimized for mobile reading stamina.
   Evidence:
   - Planets table first, then houses/aspects, then configurations, balances, and special points.
   Impact:
   - The user is asked to process large tables early.
   - There is not enough progressive disclosure before high-density material.
   - The page delivers depth quickly, but not gently.

6. The section cards and typography are visually clean, but the report still leans too hard on tables.
   Evidence:
   - Most core sections are table-based.
   - Configurations and balances are the only areas that start to feel more card-like.
   Impact:
   - Mobile scanning is slower than it should be.
   - Key insights are buried inside rows rather than surfaced above them.
   - The page rewards determined reading, but not quick comprehension.

7. The legend is useful, but its placement and form factor are not ideal for phones.
   Evidence:
   - It expands as a large block under the summary.
   Impact:
   - It adds another explanatory slab before content.
   - On mobile it risks feeling like mandatory pre-reading instead of optional help.
   - Users who need it may still have to toggle in and out too often because it is detached from the specific tables it explains.

8. There is almost no mobile-specific behavioral adaptation in JS beyond rendering the same data and toggling the legend.
   Evidence:
   - `natal-full.js` renders the report but does not introduce alternative mobile views, summaries, or condensed cards.
   Impact:
   - The mobile screen relies mostly on CSS resizing, not on UX restructuring.
   - This limits how good the phone experience can become without rethinking output shape.

### Improvement proposals

1. Rebuild `natal-full` around a mobile reading ladder.
   Proposed order:
   - Insight summary.
   - Dominants and pattern.
   - Key planets.
   - Key houses/aspects.
   - Full tables on demand.
   This turns the page from “report dump” into “guided report”.

2. Replace the giant planets table on mobile with stacked analytical cards.
   Each planet card could contain:
   - Planet + sign + house.
   - Essential dignity/motion.
   - Key aspects count or top aspect.
   - Feature badges.
   - Ruled houses.
   Full desktop table can remain for wider screens.

3. Turn houses and aspects into mobile summaries plus expandable detail blocks.
   Example:
   - Top angular houses.
   - Most exact aspects.
   - Most influential configuration.
   Then let the user open complete lists if needed.

4. Compress the top chrome into one more intelligent hero-summary block.
   Proposed UX:
   - Merge header metadata and summary into one strong mobile introduction.
   - Keep legend help secondary, for example in a sheet or contextual info affordance.

5. Make the legend contextual instead of global-heavy.
   Proposed UX:
   - Small inline help chips near dignity/motion/features labels.
   - Bottom sheet glossary when needed.
   - Avoid a large explanatory slab before the report.

6. Use visual synthesis more aggressively before raw data.
   Good candidates:
   - Dominant elements/modes as richer cards.
   - “Main tensions / main strengths” summary chips.
   - Short plain-language interpretation lead-in before the tables.

7. Reduce horizontal-scroll dependence on phones.
   Principle:
   - If a section requires sideways scrolling to understand one item, it should become a stacked component on mobile.

### Priority

Highest-value changes for `natal-full`:
- Replace mobile table-first flow with summary-first flow.
- Convert planets/houses/aspects into mobile cards or expandable blocks.
- Compress top-of-page chrome and make the legend more contextual.

### Next page

Next planned audit target:
- `forecast.html`

## 6. `forecast.html` — mobile audit complete

Role in product:
- Ongoing utility and retention screen.
- Forecast workspace for timeline, biwheel, event table, and solar return.
- A high-value but high-complexity screen where mobile clarity is essential.

Files reviewed:
- `swisseph/app/frontend/forecast.html`
- `swisseph/app/frontend/css/forecast.css`
- `swisseph/app/frontend/js/forecast.js`

### Main mobile issues

1. The page also disables native browser zoom.
   Evidence:
   - `forecast.html` uses `maximum-scale=1.0, user-scalable=no`.
   Impact:
   - This is a serious accessibility and usability issue on a dense analytical screen.
   - Users lose a core mobile behavior exactly where text, charts, and controls are most complex.

2. The screen has too many top-level modes for a phone-sized workflow.
   Evidence:
   - Four primary tabs: biwheel, timeline, table, solar.
   - Each tab adds its own secondary control system.
   Impact:
   - The page feels like several advanced tools living inside one mobile container.
   - Mental load is high before the user even starts reading the forecast.
   - The product is powerful, but the mobile experience feels instrument-heavy.

3. The controls bar is responsive, but still too dense for fast mobile use.
   Evidence:
   - Date ranges, presets, location, solar inputs, and calculate CTA all live in the top controls area.
   - JS dynamically hides and shows groups depending on the active tab.
   Impact:
   - This reduces clutter somewhat, but the user still encounters a busy control surface.
   - On phones the top of the screen feels operational before it feels understandable.
   - For repeated use, the page can feel more like a console than a polished forecast companion.

4. The biwheel tab remains the heaviest mobile surface.
   Evidence:
   - Time controls, left ingress panel, main chart, right aspects panel, floating filters, floating zoom, settings, focus mode, and overlay toggles all coexist.
   - On mobile the side panels stack vertically rather than being fundamentally rethought.
   Impact:
   - The biwheel mode still carries desktop complexity into the phone experience.
   - Mobile users can access everything, but at the cost of clarity and calm.
   - It is easy to lose the main task inside a dense control environment.

5. Focus mode is a smart mitigation, but it feels like a rescue tool rather than the default mobile strategy.
   Evidence:
   - `forecast-focus-active` hides top controls and tabs.
   Impact:
   - This suggests the default layout is already too heavy.
   - Focus mode helps, but it is not a substitute for a cleaner baseline mobile hierarchy.

6. The timeline and table tabs are still mostly desktop paradigms adapted downward.
   Evidence:
   - Timeline uses canvas plus sticky filters and legend.
   - Table tab keeps sortable columns and filter toolbar.
   Impact:
   - These tabs are functional, but they still expect a wide reading surface.
   - On mobile they can feel more like technical dashboards than guided forecast views.

7. The help experience is useful but too large and interruption-heavy for phones.
   Evidence:
   - A full-screen overlay with many long explanatory sections opens from the header.
   Impact:
   - Good educational intent, but the modal becomes a long reading detour.
   - On mobile, contextual help often works better than one large manual.

8. Solar return is effectively another advanced chart screen embedded inside forecast.
   Evidence:
   - The solar tab contains its own chart, panel tabs, settings, and zoom controls.
   Impact:
   - This adds even more conceptual scope to the page.
   - For mobile users, it risks turning one screen into too many advanced sub-products.

9. The forecast chat assistant is present on top of an already crowded workspace.
   Evidence:
   - Floating chat toggle and expandable chat widget remain on the page.
   Impact:
   - Discoverability is high, but spatial competition is high too.
   - On mobile, the assistant risks feeling like one more layer in an already layered screen.

### Improvement proposals

1. Re-enable native zoom immediately.
   This is the most important mobile accessibility fix for `forecast`.

2. Reframe the mobile forecast experience around one primary use case at a time.
   Suggested default mobile order:
   - “What is active now?”
   - “What is coming next?”
   - “Deep dive tools”
   This would make the page feel more like a guided forecast product and less like a tool cockpit.

3. Make one forecast mode the default mobile landing mode.
   Recommendation:
   - Lead with a summary-driven timeline or active-now view.
   - Treat biwheel, table, and solar as deeper specialist modes.

4. Compress or progressive-disclose the top controls.
   Proposed UX:
   - Primary date context visible.
   - Advanced range/location settings behind a compact expand/collapse pattern.
   - Keep the calculate action prominent without exposing every parameter at once.

5. Simplify mobile biwheel structurally, not just responsively.
   Proposed UX:
   - Chart first.
   - One collapsible insight rail.
   - One secondary details panel at a time.
   - Reduce simultaneous floating controls.

6. Turn timeline and table into more mobile-native reading surfaces.
   Example:
   - Timeline: summary cards first, canvas second.
   - Table: event cards or grouped date sections before full tabular detail.

7. Replace the large help overlay with contextual learning.
   Proposed UX:
   - Small info chips.
   - Inline explanations near timeline, biwheel, and solar.
   - Short mobile-friendly glossary sheet instead of a long manual modal.

8. Reconsider how solar return lives on mobile.
   Options:
   - Keep it as a separate advanced mode with a cleaner entry.
   - Or drastically simplify the default solar screen to one chart plus one summary panel.

9. Make the AI assistant task-oriented.
   Suggested entry prompts:
   - Explain the strongest active influences.
   - Summarize this month.
   - Highlight the most exact events.
   That would make the assistant feel like a forecast guide instead of an extra floating widget.

### Priority

Highest-value changes for `forecast`:
- Re-enable native browser zoom.
- Reduce mode/control overload on the mobile default state.
- Make forecast summary the primary mobile experience, with biwheel/table/solar as deeper drill-down tools.

### Next page

Next planned audit target:
- `interpretations.html` only if explicitly needed

## Status

`interpretations.html` skipped by request.

First-pass mobile audit complete for the main product flow:
- `index.html`
- `login.html`
- `clients.html`
- `chart.html`
- `natal-full.html`
- `forecast.html`

## Prioritized Backlog

### P0 — critical mobile fixes

1. Re-enable native browser zoom on dense analytical screens.
   Pages:
   - `chart.html`
   - `forecast.html`
   Why:
   - Current viewport settings disable native zoom on the most complex mobile screens.
   - This is both a usability and accessibility issue.

2. Fix mobile form geometry across the product.
   Pages:
   - `index.html`
   - client edit flows in `clients.html`
   - client edit flows in `chart.html`
   Why:
   - Repeated horizontal name/date/time groupings are too dense on phones.
   - This affects input confidence, completion speed, and error recovery.

3. Remove technical clutter from the primary mobile chart-creation flow.
   Pages:
   - `index.html`
   Why:
   - Coordinates are overexposed in the default path.
   - The first key conversion screen needs to feel guided, not technical.

4. Reduce mobile overlay overload on core chart and forecast surfaces.
   Pages:
   - `chart.html`
   - `forecast.html`
   Why:
   - Floating controls, legends, settings, nav, and chat compete for the same screen area.
   - The result is functional but visually over-instrumented.

5. Clarify primary mobile task hierarchy on workspace screens.
   Pages:
   - `clients.html`
   - `forecast.html`
   Why:
   - Both screens currently expose too much structure before the main job is obvious.
   - Repeated users should reach the working surface faster.

### P1 — high-value UX restructuring

1. Rebuild `clients` mobile list as true cards instead of a transformed table.
   Why:
   - Current stacked table rows still feel desktop-derived.
   - Card-based presentation will improve scan speed and tap clarity.

2. Rework `login` mobile auth flow into clearer state families.
   Why:
   - Many auth states currently live in one card with similar visual treatment.
   - The screen needs stronger distinction between form, success, wait, and recovery states.

3. Add summary-first reading flow to `chart`.
   Why:
   - The user needs help understanding what matters first.
   - Mobile should guide interpretation, not only provide controls.

4. Rebuild `natal-full` mobile report around summaries and expandable detail.
   Why:
   - It is currently a compressed desktop report.
   - The strongest improvement would come from replacing table-first reading with insight-first reading.

5. Make `forecast` mobile default mode summary-driven.
   Why:
   - The page currently opens as a powerful multi-tool.
   - Mobile should default to “what is active now / what matters next” and let users drill deeper.

6. Replace modal-desktop edit flows with mobile-native sheets or full-screen editors.
   Pages:
   - `clients.html`
   - `chart.html`
   Why:
   - Editing dense birth data inside scrollable overlays is fragile on phones.

### P2 — polish and product quality upgrades

1. Contextualize legends and help instead of presenting large static explanation blocks.
   Pages:
   - `natal-full.html`
   - `forecast.html`

2. Make AI assistant entry points more task-oriented on mobile.
   Pages:
   - `chart.html`
   - `forecast.html`

3. Compress header chrome on utility screens.
   Pages:
   - `clients.html`
   - `chart.html`
   - `natal-full.html`
   - `forecast.html`

4. Introduce sticky or smarter mobile filter patterns where repeated use matters.
   Pages:
   - `clients.html`
   - `forecast.html`

## Recommended Execution Order

1. Fix the mobile form system and remove native zoom restrictions.
2. Clean up `index` and `login` because they directly affect conversion.
3. Rebuild `clients` mobile list and edit flow because it affects daily operational use.
4. Simplify `chart` mobile overlays and add summary-first guidance.
5. Rework `natal-full` into a true mobile report.
6. Reframe `forecast` into a mobile-first forecast workflow after the chart/report surfaces are cleaner.
