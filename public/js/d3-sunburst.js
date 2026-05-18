/**
 * D3 Sunburst Chart Utility for Flavor Wheels
 */
const SunburstChart = {
    /**
     * Renders a Sunburst chart
     * @param {string} selector - CSS selector for the SVG container
     * @param {Object} rawData - Hierarchical data (from flavor-wheels.json)
     * @param {Object} options - Configuration options
     */
    render: function (selector, rawData, options = {}) {
        const width = options.width || 600;
        const height = options.height || 600;
        const radius = Math.min(width, height) / 2;
        const isMobile = window.innerWidth < 768;

        const selection = options.selection || []; // Array of selected node names
        const isWidget = options.isWidget || false; // If true, prune unselected nodes

        // Transform data if it's an object of categories
        let rootData = rawData;
        if (!rawData.children && typeof rawData === 'object') {
            rootData = {
                name: "root",
                children: Object.keys(rawData).map(key => ({
                    name: key,
                    ...rawData[key]
                }))
            };
        }

        // Clear container
        const container = d3.select(selector);
        container.selectAll("*").remove();

        const svg = container
            .append("svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("width", "100%")
            .attr("height", "100%")
            .append("g")
            .attr("transform", `translate(${width / 2}, ${height / 2})`);

        // Create hierarchy
        let root = d3.hierarchy(rootData)
            .sum(d => d.children ? 0 : 1);

        // Visibility flagging
        root.descendants().forEach(d => {
            const name = d.data.name;
            // Si es widget y no hay selección, nada es visible por defecto
            let isVisible = false;
            if (isWidget && selection.length === 0) {
                isVisible = false;
            } else {
                isVisible = selection.length === 0 || selection.some(s => {
                    if (typeof s === 'string') return s === name;
                    if (typeof s === 'object' && s !== null) {
                        return s.subnote === name || s.name === name;
                    }
                    return false;
                });
            }
            d.isVisible = isVisible;
            d.data.isVisible = isVisible; // Importante para el sum()
        });

        // Propagate visibility up
        root.descendants().reverse().forEach(d => {
            if (d.isVisible && d.parent) {
                let p = d.parent;
                while (p) {
                    p.isVisible = true;
                    p.data.isVisible = true;
                    p = p.parent;
                }
            }
        });

        // If widget, recalculate sums based on visibility
        if (isWidget && selection.length > 0) {
            root.sum(d => {
                if (d.isVisible) {
                    const hasVisibleChildren = d.children && d.children.some(c => c.isVisible);
                    if (!hasVisibleChildren) return 1;
                }
                return 0;
            });
        }

        const partition = d3.partition()
            .size([2 * Math.PI, radius]);

        partition(root);

        const arc = d3.arc()
            .startAngle(d => d.x0)
            .endAngle(d => d.x1)
            .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
            .padRadius(radius / 2)
            .innerRadius(d => d.y0)
            .outerRadius(d => d.y1 - 1);

        // Render arcs
        const path = svg.append("g")
            .selectAll("path")
            .data(root.descendants().filter(d => d.depth > 0 && (d.x1 - d.x0 > 0.001)))
            .enter()
            .append("path")
            .attr("d", arc)
            .style("fill", d => {
                // Inherit color from parent if not defined
                let curr = d;
                while (curr && !curr.data.color) curr = curr.parent;
                return (curr && curr.data.color) ? curr.data.color : "#ccc";
            })
            .style("stroke", "#fff")
            .style("stroke-width", "1px")
            .style("cursor", options.onClick ? "pointer" : "default")
            .style("opacity", d => {
                if (selection.length === 0) return isWidget ? 0.05 : 1;
                return d.isVisible ? 1 : 0.15;
            })
            .on("mouseover", function (event, d) {
                if (!options.onClick) return;
                d3.select(this).style("stroke", "#000").style("stroke-width", "2px");
            })
            .on("mouseout", function (event, d) {
                if (!options.onClick) return;
                d3.select(this).style("stroke", "#fff").style("stroke-width", "1px");
            });

        // --- ETIQUETAS CURVAS (Text on Path) ---

        // 1. Crear paths invisibles para las etiquetas
        const labelPathsGroup = svg.append("g")
            .attr("class", "label-paths")
            .style("display", "none");

        const labelData = root.descendants().filter(d => {
            if (d.depth === 0) return false;
            if (isWidget && !d.isVisible) return false;
            const angle = d.x1 - d.x0;
            const radius = (d.y0 + d.y1) / 2;
            return (angle * radius) > (isMobile ? 12 : 8);
        });

        labelData.forEach((d, i) => {
            const r = (d.y0 + d.y1) / 2;
            const startAngle = d.x0 - Math.PI / 2;
            const endAngle = d.x1 - Math.PI / 2;
            const midAngle = (startAngle + endAngle) / 2;

            let pathData = "";
            // Si está en la parte inferior (entre 0 y PI en radianes de SVG), invertimos el path
            // para que el texto no salga de cabeza.
            if (midAngle > 0 && midAngle < Math.PI) {
                pathData = `M ${r * Math.cos(endAngle)},${r * Math.sin(endAngle)} 
                            A ${r},${r} 0 0 0 ${r * Math.cos(startAngle)},${r * Math.sin(startAngle)}`;
            } else {
                pathData = `M ${r * Math.cos(startAngle)},${r * Math.sin(startAngle)} 
                            A ${r},${r} 0 0 1 ${r * Math.cos(endAngle)},${r * Math.sin(endAngle)}`;
            }

            labelPathsGroup.append("path")
                .attr("id", `path-${selector.replace(/[^a-zA-Z]/g, "")}-${i}`)
                .attr("d", pathData);
        });

        // 2. Renderizar los textos siguiendo los paths
        const labels = svg.append("g")
            .attr("pointer-events", "none")
            .attr("text-anchor", "middle")
            .attr("font-family", "'Inter', sans-serif")
            .selectAll("text")
            .data(labelData)
            .enter()
            .append("text")
            .attr("font-size", d => {
                const angle = d.x1 - d.x0;
                const radius = (d.y0 + d.y1) / 2;
                const arcLength = angle * radius;
                const text = d.data.name;

                // Determinar si habrá salto de línea para ajustar el cálculo de tamaño
                let parts = [];
                if (text.includes('/')) {
                    parts = text.split('/');
                } else if (text.length > 12 && text.includes(' ') && arcLength < text.length * 6) {
                    parts = text.split(' ');
                } else {
                    parts = [text];
                }

                const comparisonText = parts.reduce((a, b) => a.length > b.length ? a : b, "");

                // Ajustamos el factor para que intente ocupar el 90% del ancho del arco (contenedor)
                let size = (arcLength * 0.90) / (comparisonText.length * 0.5);

                // Aumentamos los tamaños máximos y mínimos, dándole más libertad en móvil
                const maxSize = d.depth === 1 ? (isMobile ? 28 : 22) : (d.depth === 2 ? (isMobile ? 26 : 16) : (isMobile ? 24 : 13));
                const minSize = isMobile ? 10 : 8;

                size = Math.min(maxSize, Math.max(minSize, size));

                return `${size}px`;
            })
            .attr("font-weight", d => d.depth === 1 ? "900" : "700")
            .style("fill", "#fff")
            .style("text-shadow", "0px 1px 3px rgba(0,0,0,0.4)")
            .style("opacity", d => {
                if (selection.length === 0) return isWidget ? 0 : 1;
                return d.isVisible ? 1 : 0.15;
            })
            .each(function (d, i) {
                const el = d3.select(this);
                const text = d.data.name;
                const angle = d.x1 - d.x0;
                const radius = (d.y0 + d.y1) / 2;
                const arcLength = angle * radius;

                const midAngle = ((d.x0 + d.x1) / 2) - Math.PI / 2;
                const isFlipped = midAngle > 0 && midAngle < Math.PI;

                let parts = [];
                if (text.includes('/')) {
                    const split = text.split('/');
                    parts = split.map((p, ix) => ix < split.length - 1 ? p + '/' : p);
                } else if (text.length > 12 && text.includes(' ') && arcLength < text.length * 6) {
                    parts = text.split(' ');
                } else {
                    parts = [text];
                }

                const pathId = `#path-${selector.replace(/[^a-zA-Z]/g, "")}-${i}`;

                parts.forEach((p, lineIdx) => {
                    const tp = el.append("textPath")
                        .attr("startOffset", "50%")
                        .attr("xlink:href", pathId);

                    // Cálculo de dy para centrar verticalmente sobre el path (radius central)
                    let dyBase = 0.35; // 0.35em centra perfectamente el medio del texto sobre la línea
                    if (parts.length > 1) {
                        const offset = (lineIdx - (parts.length - 1) / 2) * 1.1;
                        dyBase += offset;
                    }

                    tp.append("tspan")
                        .attr("dy", `${dyBase}em`)
                        .text(p);
                });
            });

        if (isWidget && selection.length > 0) {
            const centerTextGroup = svg.append("g")
                .attr("class", "center-label")
                .style("opacity", 0.8);

            const brandName = "Rurulab";
            // Asegurar que no se salga del centro (y0 del primer nivel)
            const innerHoleRadius = root.children ? root.children[0].y0 : radius * 0.3;
            let centerFontSize = radius * 0.15;

            const maxTextWidth = innerHoleRadius * 1.7;
            const estimatedWidth = brandName.length * (centerFontSize * 0.55);

            if (estimatedWidth > maxTextWidth) {
                centerFontSize = (maxTextWidth / (brandName.length * 0.55));
            }

            const mainAnchor = centerTextGroup.append("a")
                .attr("href", "https://rurulab.com")
                .attr("target", "_blank")
                .style("cursor", "pointer");

            mainAnchor.append("text")
                .attr("text-anchor", "middle")
                .attr("dy", "-0.1em")
                .attr("font-size", `${centerFontSize}px`)
                .attr("font-weight", "400")
                .attr("font-style", "italic")
                .attr("font-family", "'Playfair Display', serif")
                .style("fill", "#78350f")
                .text(brandName);

            mainAnchor.append("text")
                .attr("text-anchor", "middle")
                .attr("dy", "1.4em")
                .attr("font-size", `${centerFontSize * 0.3}px`)
                .attr("font-weight", "bold")
                .attr("font-family", "'Inter', sans-serif")
                .style("fill", "#a8a29e")
                .style("letter-spacing", "0.2em")
                .text(".com");
        }

        // Interactivity
        if (options.onClick) {
            path.on("click", (event, d) => {
                options.onClick(d);
            });
        }

        return { svg, root, arc };
    }
};

if (typeof window !== 'undefined') {
    window.SunburstChart = SunburstChart;
}
