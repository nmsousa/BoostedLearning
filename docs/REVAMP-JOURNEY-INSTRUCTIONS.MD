# TASK: Complete UI/UX Redesign – Premium Gamified Language Learning Experience

You are a Senior UI/UX Designer, Senior Angular Developer and Senior Ionic Developer with extensive experience building premium mobile applications.

Your task is to completely redesign the existing language-learning lesson progression screen to achieve a visually stunning, modern, polished and highly engaging experience.

You have been provided with two visual references:

- **Reference 1:** The existing application screen. Use it to understand the current functionality, content, lesson progression and existing application behaviour.
- **Reference 2:** The new visual design target. This is the primary visual reference. Reproduce its visual language, layout, composition, colours, effects and overall experience as closely as possible.

The target is a premium, gamified language-learning application with a visual quality comparable to Duolingo, modern mobile gaming interfaces and high-end educational applications.

IMPORTANT: Do not simply apply a new colour palette to the existing screen. Completely rethink and rebuild the visual presentation while preserving the underlying application functionality.

The result must be a real, functional Angular/Ionic implementation, not a static HTML mockup.

---

# 1. FIRST: ANALYSE THE EXISTING PROJECT

Before modifying anything:

1. Inspect the existing Angular/Ionic project structure.
2. Identify the current page/component responsible for rendering the lesson progression screen.
3. Understand its existing HTML, SCSS, TypeScript and dependencies.
4. Identify how lesson data, completion status, locked/unlocked states and navigation are currently managed.
5. Identify existing reusable components, services, models, icons and design conventions.
6. Determine the Ionic and Angular versions.
7. Identify whether the application uses Capacitor and which platforms it supports.
8. Understand the existing routing and navigation mechanisms.

Do not introduce unnecessary dependencies or replace existing application architecture.

Do not modify unrelated screens or functionality.

Preserve all existing business logic, services, APIs, models and navigation behaviour unless a change is strictly necessary for the redesign.

The redesign should primarily affect the UI layer.

---

# 2. DESIGN VISION

Create an immersive, visually rich, premium mobile learning experience.

The screen should feel like an interactive adventure map rather than a traditional list of lessons.

The user should feel that they are progressing through a journey, unlocking new learning experiences and earning rewards.

## Overall visual style

Use the following design characteristics:

- Deep midnight-blue / navy background.
- Rich blue and purple gradients.
- Atmospheric illustrated landscapes.
- Glowing neon accents.
- Soft lighting and ambient illumination.
- Glassmorphism for information panels.
- Subtle shadows and depth.
- Rounded shapes and smooth curves.
- Vibrant green for completed lessons.
- Bright cyan/electric blue for the active lesson.
- Muted purple/blue for locked lessons.
- White typography with excellent contrast.
- Premium, polished, game-like visual presentation.

The interface must feel modern and sophisticated, not childish.

Avoid excessive decoration, unnecessary borders, generic Bootstrap-looking components or flat material-design cards.

Use a coherent design system with consistent spacing, typography, colours, shadows, border radii and visual hierarchy.

---

# 3. SCREEN STRUCTURE

Rebuild the screen using the following major sections.

## A. Main background and atmosphere

The entire screen should use a deep navy-blue background with a subtle gradient.

Introduce an atmospheric illustrated environment behind the lesson progression map.

Visual inspiration:

- Night sky with subtle stars.
- Soft clouds.
- Rolling hills.
- Glowing distant city lights.
- Recognisable architectural landmarks.
- Subtle atmospheric lighting.
- Different landscape elements distributed vertically.

The background should create depth without competing with the lesson nodes.

For the illustrated environment, prioritise the following approaches:

1. Reuse existing application assets if suitable.
2. If possible, create a dedicated high-quality background illustration.
3. Otherwise, use carefully layered SVG illustrations, CSS gradients and decorative elements.

IMPORTANT:
Do not use the entire reference screenshot as a background image.
Do not bake text, lesson labels, icons or interactive elements into the background image.
The background must be an independent visual asset, while all interface elements remain real HTML/Ionic components.

The background should scale appropriately across different screen sizes without distorting important elements.

## B. Header

Create a premium header at the top of the screen.

Layout:

- Circular back button on the left.
- Small thematic illustration or emoji next to the title.
- Main lesson/course title.
- Short descriptive subtitle underneath.
- Language selector on the right.

Example content:

Title: Order at a café

Subtitle: Learn useful phrases for your next coffee!

Language selector: French flag + Français + dropdown indicator.

Visual requirements:

- Back button with a translucent dark-blue background.
- Circular shape.
- Subtle border and shadow.
- Large, readable title.
- Smaller muted subtitle.
- Language selector styled as a rounded glass-like pill.
- Flag and dropdown icon properly aligned.
- Header elements must remain correctly positioned on narrow devices.

The language selector must remain functional.

---

# 4. LESSON PROGRESSION MAP

This is the most important part of the screen.

Replace the existing basic vertical sequence of circles with an immersive, winding learning path.

The lesson path should visually move from left to right and back again as it progresses vertically.

The path must feel organic and continuous, like a game progression map.

## A. Path design

Use a curved, winding progression path connecting lesson nodes.

The path should be created using SVG.

Recommended approach:

- Use an SVG element positioned behind the lesson nodes.
- Draw smooth curved paths using SVG Bezier curves.
- Use dashed strokes.
- Use different colours depending on progression status.
- Use rounded line caps.
- Ensure the path connects visually to the centre of each lesson node.

Completed/current path:
- Bright green or cyan.
- Slightly glowing.
- Rounded dashed segments.

Upcoming/locked path:
- Muted lavender/grey.
- Lower opacity.
- More subtle appearance.

The SVG must scale responsively.

Do not use manually positioned individual dash elements or disconnected CSS lines.

Use a continuous SVG path for the progression route.

## B. Lesson nodes

Each lesson should be represented by a large circular interactive element.

Nodes should have:

- Circular shape.
- Strong visual hierarchy.
- White or coloured outer border.
- Inner gradient.
- Soft shadow.
- Optional neon glow.
- Large, clear icon.
- Smooth hover/press animations.

Implement three distinct visual states.

### Completed lessons

Visual style:
- Vibrant green gradient.
- Bright green outer glow.
- White border.
- White icon.
- Optional checkmark or completion indicator.

These lessons should visually communicate success.

### Active lesson

This is the most important node.

Visual style:
- Bright cyan / electric blue gradient.
- Thick white circular border.
- Additional outer cyan glow.
- Subtle animated pulse.
- Large white icon.
- More prominent size than the other nodes.

The active lesson should immediately attract attention.

Its associated information panel should be visually connected to the node.

Example:

Icon: Practice / writing.

Title: Practice

Duration: 8 min

Include a small circular arrow button on the right side of its information panel.

This entire element should communicate that it is the next action available to the user.

### Locked lessons

Visual style:
- Dark navy/purple background.
- Muted grey-purple icon.
- Subtle outer border.
- Low-intensity shadow.
- Lock icon.

Locked lessons should look disabled without completely disappearing.

Do not make them visually confusing or impossible to identify.

---

# 5. LESSON INFORMATION PANELS

Do not display all lesson titles underneath or above their nodes in a generic vertical list.

Introduce contextual information panels alongside the progression nodes.

Examples:

Completed lesson:

- Green checkmark.
- "Learned!"
- "Great job!"

Completed quiz:

- Yellow star.
- "Quiz Time"
- Clock icon.
- "5 min"

Active lesson:

- "Practice"
- Clock icon.
- "8 min"
- Circular forward arrow.

Locked lesson:

- "Dialogue"
- "Unlocks after completing Practice"

Next locked lesson:

- "Vocabulary"
- "Unlocks after completing Dialogue"

Next locked lesson:

- "Grammar"
- "Unlocks after completing Vocabulary"

Design requirements:

- Rounded corners.
- Semi-transparent dark-blue background.
- Subtle glassmorphism.
- Soft border.
- Proper alignment with the associated lesson node.
- Clear typography hierarchy.
- Consistent padding.
- Responsive widths.

The active lesson panel should be visually different and more prominent.

Consider using a brighter surface or a lighter gradient for the active lesson.

Avoid panels that overlap other nodes or make the progression path difficult to understand.

---

# 6. BOTTOM PROGRESS PANEL

Introduce a premium progress dashboard anchored near the bottom of the screen.

This is an important gamification element.

It should display:

### Progress indicator

A circular progress ring.

Example:

1 / 4

Use an SVG circular progress indicator.

The ring should:
- Have a muted background track.
- Have a green progress stroke.
- Use rounded stroke caps.
- Animate when progress changes.

### Progress information

Title: Your Progress

Progress bar underneath.

Text: 25% completed

The progress bar should use a dark blue track and a vibrant green-to-cyan gradient.

### Rewards

Display a trophy icon.

Text: +50 XP

Use a bright yellow/gold colour for the reward.

### Primary action

Large rounded button:

"Keep going!"

Include a forward arrow.

Visual style:
- Green-to-cyan gradient.
- Dark text.
- Rounded pill shape.
- Subtle glow.
- Smooth press animation.
- Strong visual prominence.

The button must navigate to the currently active lesson.

The bottom panel should feel like a premium floating HUD/game interface.

Use a translucent navy background, subtle border, shadow and backdrop blur.

IMPORTANT:
The bottom panel must never cover essential lesson nodes.

On devices with limited vertical space, implement an appropriate responsive strategy. Consider a compact version of the panel, a collapsible layout or a scroll-aware bottom section.

Respect Ionic safe-area insets.

---

# 7. RESPONSIVE DESIGN

This application is built with Angular and Ionic and must work correctly on mobile devices.

The design must be responsive and tested against different screen sizes.

At minimum, consider:

- 360 × 640
- 375 × 812
- 390 × 844
- 412 × 915
- 430 × 932
- Tablet portrait.
- Tablet landscape.

Do not hardcode the entire design to the dimensions of the reference screenshot.

Use responsive CSS.

Prefer:
- Flexbox.
- CSS Grid.
- Relative units.
- clamp().
- CSS custom properties.
- SVG viewBox and preserveAspectRatio.
- Ionic safe-area variables.

Use viewport-aware sizing where appropriate.

The lesson progression should remain visually balanced across different aspect ratios.

The background illustration should not stretch unnaturally.

The lesson nodes should remain sufficiently large for touch interaction.

All interactive targets should ideally be at least 44 × 44 CSS pixels.

The page must support vertical scrolling when necessary.

Avoid horizontal scrolling.

---

# 8. ANGULAR / IONIC IMPLEMENTATION

This must be implemented properly using the existing Angular/Ionic architecture.

Do not build an isolated HTML prototype.

Use the existing component structure and conventions.

Suggested component decomposition, if appropriate for the existing project:

- lesson-map-page
- lesson-map-header
- lesson-path
- lesson-node
- lesson-info-panel
- lesson-progress-footer

You do not need to create all these components if the existing architecture suggests a better approach.

Avoid unnecessary component fragmentation.

## Angular

Requirements:

- Use the existing Angular version and supported syntax.
- Preserve existing TypeScript models.
- Use strongly typed interfaces.
- Avoid unnecessary `any`.
- Use the existing data flow and services.
- Keep business logic outside the template.
- Use Angular signals only if compatible with the project's version and existing conventions.
- Avoid unnecessary subscriptions and memory leaks.
- Preserve existing navigation and event handlers.

## Ionic

Use Ionic components where they provide value.

Examples:

- ion-content
- ion-button
- ion-icon
- ion-header
- ion-toolbar
- ion-footer

However, do not force Ionic components into every element.

Custom HTML and SCSS are perfectly acceptable for the lesson map, SVG path, progress ring and decorative elements.

The result should feel like a premium custom-designed application rather than a standard Ionic application.

## SCSS / CSS

Create a coherent design system.

Use CSS variables for:

- Background colours.
- Primary and secondary colours.
- Completed state colours.
- Active state colours.
- Locked state colours.
- Border radii.
- Shadows.
- Glow effects.
- Spacing.
- Typography.
- Animation timings.

Avoid duplicating CSS values throughout the application.

Use component-scoped styles where appropriate.

Avoid excessive `!important`.

Avoid using fixed pixel positioning for the entire layout.

---

# 9. ANIMATIONS AND MICRO-INTERACTIONS

Add subtle, premium animations to make the application feel alive.

Do not over-animate everything.

Recommended animations:

### Active lesson node

- Slow breathing/pulsing glow.
- Subtle scale animation.
- Slightly animated outer ring.

### Completed lesson nodes

- Optional subtle glow.
- Small completion animation when a lesson is completed.

### Progress path

- Subtle glowing effect.
- Optional animated dash offset to suggest progression.

### Progress ring

- Smooth animated stroke transition.

### Progress bar

- Smooth width transition when progress changes.

### Buttons

- Scale down slightly when pressed.
- Smooth transition between states.

### Lesson information panels

- Subtle fade-in or slide-in on initial rendering.

Respect `prefers-reduced-motion`.

Avoid heavy JavaScript animation libraries unless already available in the project.

Prefer CSS animations and transitions.

---

# 10. ICONOGRAPHY AND VISUAL ASSETS

Use a consistent icon library already available in the project.

If an icon library is not available, inspect the project before adding a dependency.

Suitable icon sources include:

- Ionicons.
- Lucide.
- Existing SVG icons.

Use consistent stroke widths and icon sizes.

For the example lesson sequence:

- Café ordering: appropriate café/serving icon.
- Quiz: question mark.
- Practice: writing/editing icon.
- Locked lessons: lock icon.
- Progress: trophy.
- Navigation: arrow and chevron.

Do not mix unrelated icon styles.

For the illustrated environment, use high-quality assets rather than attempting to construct complex landmarks using dozens of primitive CSS shapes.

---

# 11. FUNCTIONAL REQUIREMENTS

The redesign must preserve and correctly display all existing lesson data.

The following information must remain dynamic:

- Lesson title.
- Lesson description.
- Lesson type.
- Completion state.
- Locked/unlocked state.
- Duration.
- XP rewards.
- Current progress.
- Language.
- Available navigation actions.

Do not hardcode the example values from the screenshot if the application already provides these values dynamically.

Each lesson node must retain its existing functionality.

Expected behaviour:

- Completed lessons remain accessible if currently supported.
- Active lessons navigate to the appropriate lesson.
- Locked lessons cannot be started.
- The language selector retains its existing behaviour.
- Back navigation works.
- The progress indicator reflects actual application data.
- The primary CTA opens the current active lesson.

Make sure all clickable elements have proper accessibility labels.

Use appropriate semantic HTML.

Ensure good contrast and keyboard accessibility where relevant.

---

# 12. PERFORMANCE

The application must remain lightweight and performant.

Avoid:

- Excessive DOM elements.
- Unnecessary SVG filters.
- Large unoptimised background images.
- Excessive backdrop-filter usage.
- Continuous animations on every element.
- Unnecessary dependencies.
- Repeated change detection caused by expensive template expressions.

Optimise image assets.

Consider WebP or AVIF for background illustrations.

Use CSS gradients and SVG for lightweight effects.

Make sure the design performs well on mid-range Android devices.

---

# 13. IMPLEMENTATION WORKFLOW

Do not attempt to implement everything blindly in one pass.

Follow these steps.

## Step 1 – Analysis

Inspect the project and identify the existing implementation.

Report briefly:
- Components involved.
- Existing data structures.
- Existing functionality.
- Existing dependencies.
- Recommended implementation approach.

## Step 2 – Design architecture

Define:
- Main page structure.
- Component structure.
- Layout strategy.
- SVG progression path approach.
- Background illustration approach.
- Responsive strategy.
- Design tokens.

## Step 3 – Implement the visual foundation

Start with:
- Main background.
- Header.
- Overall layout.
- Typography.
- Design tokens.

## Step 4 – Implement the progression map

Implement:
- SVG winding path.
- Completed nodes.
- Active node.
- Locked nodes.
- Information panels.
- Node positioning.

Pay particular attention to the alignment between SVG path coordinates and lesson node positions.

The path must connect naturally to the centre of each node.

## Step 5 – Implement the progress dashboard

Implement:
- Circular progress indicator.
- Progress bar.
- XP reward.
- Primary CTA.

Make it responsive and safe-area aware.

## Step 6 – Implement animations

Add the micro-interactions and visual effects.

## Step 7 – Connect existing application logic

Connect the new UI to the actual application data and navigation.

Do not introduce mock data into the final implementation.

## Step 8 – Validate

Run the available project checks:

- Angular build.
- TypeScript compilation.
- Linting.
- Existing unit tests, where available.

Fix any errors introduced by the redesign.

If browser/device preview tools are available, inspect the result visually.

Test the layout on at least:
- A small mobile screen.
- A standard mobile screen.
- A large mobile screen.

Fix:
- Overlapping nodes.
- Misaligned SVG paths.
- Text overflow.
- Incorrect scrolling.
- Footer overlap.
- Safe-area issues.
- Inconsistent spacing.

Take screenshots and compare them with the provided visual reference.

Iterate until the result is visually polished.

---

# 14. QUALITY EXPECTATIONS

The visual target is the second reference image.

Prioritise visual fidelity to that reference.

Specifically, reproduce:

1. The deep blue atmospheric background.
2. The illustrated world surrounding the lesson path.
3. The premium header.
4. The winding green/cyan progression route.
5. The large glowing circular lesson nodes.
6. The glass-like lesson information panels.
7. The bright cyan active lesson.
8. The muted locked lessons.
9. The floating bottom progress dashboard.
10. The green/cyan primary CTA.

The result should look like a professionally designed commercial language-learning application.

Do not settle for a basic approximation.

Do not remove the visual richness of the reference in the name of simplicity.

At the same time, do not sacrifice usability, responsiveness or performance for decorative effects.

---

# 15. FINAL DELIVERABLE

Implement the redesign directly in the existing project.

When finished, provide:

1. A summary of the changes.
2. The files created or modified.
3. Any new assets or dependencies.
4. Confirmation that existing functionality was preserved.
5. Build/test results.
6. Any remaining limitations.

Do not stop after providing a plan or generating sample code.

Your responsibility is to complete the implementation, validate it and refine the visual result.

**The final objective: transform this screen into a premium, immersive, gamified language-learning experience that looks as close as reasonably possible to the provided visual reference.**

---------------------

My personal tips:
Don't implement the dotted path using individual CSS elements.

Use one SVG with Bezier curves, for example:
<svg class="lesson-path" viewBox="0 0 400 1200">
  <path
    class="path-completed"
    d="M 140 100 C 140 180, 270 180, 270 300 S 120 400, 120 520"
  />

  <path
    class="path-locked"
    d="M 120 520 C 120 650, 280 650, 280 800 S 130 900, 130 1050"
  />
</svg>
This is illustrative only; the coordinates should be calculated from the actual node positions.

SVG gives you much better control over:
- Curves.
- Dashed lines.
- Gradients.
- Glowing effects.
- Animations.
- Responsive scaling.

3. Don't position the lesson nodes using arbitrary absolute coordinates
This is particularly important for Ionic.

The generated screenshot is tall and narrow. If the LLM hardcodes every node's position, it might look fantastic on one device and terrible on another.

Instead, ask it to create a responsive map coordinate system.

For example:
- A dedicated scrollable map container.
- A fixed aspect ratio or responsive map width.
- Nodes positioned relative to the map.
- An SVG sharing the same coordinate system.
- A separate bottom progress panel.
- Safe-area handling.
That way, the SVG path and nodes remain aligned.

My suggested implementation strategy
I would actually split the work into three LLM tasks rather than letting it tackle everything simultaneously.
Phase	Task	Priority
1	Background illustration and design system	Very high
2	Lesson map, nodes, SVG path and information panels	Very high
3	Progress dashboard, animations, responsiveness and polish	High