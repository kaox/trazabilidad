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

        // Add labels
        svg.append("g")
            .attr("pointer-events", "none")
            .attr("text-anchor", "middle")
            .attr("font-size", isMobile ? "14px" : "12px")
            .attr("font-family", "'Inter', sans-serif")
            .selectAll("text")
            .data(root.descendants().filter(d => {
                if (d.depth === 0) return false;
                if (isWidget && !d.isVisible) return false;
                // Threshold for label visibility based on arc length
                return (d.x1 - d.x0) * d.y0 > (isMobile ? 25 : 18);
            }))
            .enter()
            .append("text")
            .attr("transform", function (d) {
                const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
                const y = (d.y0 + d.y1) / 2;

                // Rotación tangencial (estilo Tastify)
                // x-90 nos posiciona en el ángulo, translate nos aleja del centro
                // 90 grados adicionales nos hace tangenciales al arco
                let angle = x - 90;
                let tangentialRotation = 90;

                // Si está en la parte inferior, giramos 180 para que el texto no esté invertido
                if (x > 90 && x < 270) {
                    tangentialRotation += 180;
                }

                return `rotate(${angle}) translate(${y},0) rotate(${tangentialRotation})`;
            })
            .attr("dy", "0.35em")
            .text(d => d.data.name)
            .style("fill", "#fff")
            .style("font-weight", "500")
            .style("text-shadow", "0px 1px 2px rgba(0,0,0,0.5)")
            .style("opacity", d => {
                if (selection.length === 0) return isWidget ? 0 : 1;
                return d.isVisible ? 1 : 0.1;
            });

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
