// public/js/d3-utils.js

/**
 * Función base para renderizar un gráfico de radar (araña) usando D3.js
 * @param {string} containerSelector - Selector del elemento SVG (ej. '#radarChart')
 * @param {Object} data - Objeto de configuración de perfil (JSONB `perfil_data`)
 * @param {Object} options - Opciones de configuración del gráfico (ancho, alto, etc.)
 */
function renderRadarChart(containerSelector, data, options = {}) {
    const svg = d3.select(containerSelector);
    if (svg.empty()) return;

    svg.selectAll("*").remove(); // Limpiar el contenedor previo

    const rect = svg.node().getBoundingClientRect();
    const isMobile = window.innerWidth < 768;

    const width = options.width || rect.width || 400;
    const height = options.height || rect.height || 400;

    // Margins are important for labels. Responsive margins.
    const margin = options.margin || (isMobile
        ? { top: 40, right: 60, bottom: 40, left: 60 }
        : { top: 60, right: 100, bottom: 60, left: 100 });
    const radius = Math.min(width - margin.left - margin.right, height - margin.top - margin.bottom) / 2;

    svg.attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

    const g = svg.append("g")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);

    const labels = data.labels || [];
    const total = labels.length;
    if (total === 0) return;

    const angleSlice = Math.PI * 2 / total;
    const maxValue = options.maxValue || 10;
    const levels = options.levels || 10;

    const rScale = d3.scaleLinear()
        .range([0, radius])
        .domain([0, maxValue]);

    // --- 1. Dibujar círculos concéntricos (Niveles) ---
    const gridWrapper = g.append("g").attr("class", "gridWrapper");

    gridWrapper.selectAll(".levels")
        .data(d3.range(1, levels + 1).reverse())
        .enter()
        .append("circle")
        .attr("class", "gridCircle")
        .attr("r", d => rScale(d))
        .style("fill", "#CDCDCD")
        .style("stroke", "#CDCDCD")
        .style("fill-opacity", 0.05)
        .style("stroke-opacity", 0.3);

    // --- 2. Etiquetas de los niveles (1, 2, ..., 10) ---
    gridWrapper.selectAll(".level-labels")
        .data(d3.range(1, levels + 1))
        .enter()
        .append("text")
        .attr("class", "level-labels")
        .attr("x", 4)
        .attr("y", d => -rScale(d))
        .attr("dy", "0.4em")
        .style("font-size", "10px")
        .style("font-family", "sans-serif")
        .attr("fill", "#999")
        .text(d => d);

    // --- 3. Ejes y etiquetas externas ---
    const axisGrid = g.selectAll(".axis")
        .data(labels)
        .enter()
        .append("g")
        .attr("class", "axis");

    axisGrid.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", (d, i) => rScale(maxValue) * Math.cos(angleSlice * i - Math.PI / 2))
        .attr("y2", (d, i) => rScale(maxValue) * Math.sin(angleSlice * i - Math.PI / 2))
        .attr("class", "line")
        .style("stroke", "#E0E0E0")
        .style("stroke-width", "1px");

    axisGrid.append("text")
        .attr("class", "legend")
        .style("font-size", isMobile ? "9px" : "11px")
        .style("font-family", "Inter, sans-serif")
        .attr("text-anchor", (d, i) => {
            const angle = angleSlice * i;
            if (Math.abs(angle) < 0.1 || Math.abs(angle - Math.PI) < 0.1) return "middle";
            return angle < Math.PI ? "start" : "end";
        })
        .attr("dy", (d, i) => {
            const angle = angleSlice * i;
            if (Math.abs(angle) < 0.1) return "-0.5em";
            if (Math.abs(angle - Math.PI) < 0.1) return "1.2em";
            return "0.35em";
        })
        .attr("x", (d, i) => rScale(maxValue * (isMobile ? 1.15 : 1.2)) * Math.cos(angleSlice * i - Math.PI / 2))
        .attr("y", (d, i) => rScale(maxValue * (isMobile ? 1.15 : 1.2)) * Math.sin(angleSlice * i - Math.PI / 2))
        .text(d => d)
        .style("fill", "#666666");

    // --- 4. Dibujar el radar (polígono) ---
    const radarLine = d3.lineRadial()
        .curve(d3.curveLinearClosed)
        .angle((d, i) => i * angleSlice)
        .radius(d => rScale(d));

    const datasets = data.datasets || [];

    datasets.forEach((dataset, index) => {
        const color = dataset.color || "#3b82f6";

        const blobWrapper = g.append("g").attr("class", "radarWrapper");

        blobWrapper.append("path")
            .datum(dataset.data)
            .attr("d", radarLine)
            .style("fill", color)
            .style("fill-opacity", 0.25)
            .style("stroke", color)
            .style("stroke-width", 2.5);

        // Puntos del radar
        blobWrapper.selectAll(".radarCircle")
            .data(dataset.data)
            .enter()
            .append("circle")
            .attr("class", "radarCircle")
            .attr("r", isMobile ? 4.5 : 3.5)
            .attr("cx", (d, i) => rScale(d) * Math.cos(angleSlice * i - Math.PI / 2))
            .attr("cy", (d, i) => rScale(d) * Math.sin(angleSlice * i - Math.PI / 2))
            .style("fill", color)
            .style("fill-opacity", 1)
            .style("stroke", "#fff")
            .style("stroke-width", 1);
    });
}

// Export for module usage or attach to window
if (typeof window !== 'undefined') {
    window.renderRadarChart = renderRadarChart;
}
