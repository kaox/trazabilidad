const EmpresaModel = require('../models/empresaModel');
const { safeJSONParse } = require('../utils/helpers');

const getPublicCompaniesWithImmutable = async (req, res) => {
    try {
        // 1. Acceso a datos: Ejecutamos ambas consultas en paralelo usando el Modelo
        const [verified, suggested] = await Promise.all([
            EmpresaModel.getVerifiedCompaniesWithImmutable(),
            EmpresaModel.getSuggestedCompanies()
        ]);

        // 2. Lógica de Negocio: Combinar y ordenar
        let combined = [...verified, ...suggested].sort((a, b) => {
            // Prioridad a verificados
            if (a.status === 'verified' && b.status !== 'verified') return -1;
            if (a.status !== 'verified' && b.status === 'verified') return 1;

            // Dentro de verificados, prioridad a los que tienen más lotes
            if (a.status === 'verified' && b.status === 'verified') {
                if (b.lotes_count !== a.lotes_count) return b.lotes_count - a.lotes_count;
            }

            // Finalmente alfabético
            return a.name.localeCompare(b.name);
        });

        // 3. Lógica de Negocio: Transformación de coordenadas (Polígonos a Centroides)
        combined = combined.map(c => {
            let parsedCoords = safeJSONParse(c.coordenadas || 'null');
            
            // Si es un array de coordenadas (polígono de finca) calculamos el centroide
            if (Array.isArray(parsedCoords) && parsedCoords.length > 0) {
                let sumLat = 0;
                let sumLng = 0;
                let validPoints = 0;

                parsedCoords.forEach(point => {
                    // Soporte para formato de array: [[lat, lng], [lat, lng]]
                    if (Array.isArray(point) && point.length >= 2) {
                        sumLat += parseFloat(point[0]);
                        sumLng += parseFloat(point[1]);
                        validPoints++;
                    }
                    // Soporte para formato de objeto: [{lat, lng}, {lat, lng}]
                    else if (point && point.lat && point.lng) {
                        sumLat += parseFloat(point.lat);
                        sumLng += parseFloat(point.lng);
                        validPoints++;
                    }
                });

                if (validPoints > 0) {
                    parsedCoords = {
                        lat: sumLat / validPoints,
                        lng: sumLng / validPoints
                    };
                } else {
                    parsedCoords = null;
                }
            }

            return {
                ...c,
                coordenadas: parsedCoords
            };
        });

        // 4. Respuesta HTTP
        res.status(200).json(combined);
    } catch (err) {
        console.error("Error getPublicCompaniesWithImmutable:", err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getPublicCompaniesWithImmutable
};