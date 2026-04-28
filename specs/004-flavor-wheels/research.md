# Research: Flavor Wheels with D3.js

## Decision: Pruned Sunburst Chart (Tastify Aesthetic)
- **Findings**: The core differentiator (FR-013) is showing only the selected sensory path in the final widget.
- **Approach**: 
  - Use `d3.hierarchy(data).eachBefore(callback)` to flag nodes.
  - A node is visible if:
    1. It is explicitly selected.
    2. It is an ancestor of a selected node.
    3. (Optional) It is a direct child of a selected node (for visual context).
  - Use `node.sum(d => (isVisible ? d.value : 0))` or filter the hierarchy before `d3.partition`.
- **Rationale**: Direct alignment with the requested Tastify-like visual impact.

## Decision: Static Interaction (No Zoom)
- **Findings**: Maintain a fixed center to keep the user oriented.
- **Approach**: 
  - The Sunburst maintains its radial scale regardless of which segment is clicked.
  - Interaction will trigger highlighting (opacity 1.0 vs 0.3) for the selected path.
- **Rationale**: Better UX for sensory profiling where the relationship to the "core" (Fruit, Floral, etc.) is always relevant.

## Decision: Color and Icon Management
- **Findings**: Adhere to SCA/Cocoa of Excellence palettes.
- **Approach**: 
  - `flavor-wheels.json` already contains the canonical hex colors.
  - D3 will map these colors to the `path` elements.
  - Icons will be rendered using FontAwesome classes within SVG `text` or `foreignObject` if needed.
- **Rationale**: Professional standard compliance.

## Decision: Public Tokens for Widgets
- **Findings**: Widgets must be accessible via a shareable, revocable link.
- **Approach**: 
  - `ruedas_sabores.public_token` will be a UUID.
  - A middleware will validate the token before serving the data to the widget.
- **Rationale**: Security and ease of use.
