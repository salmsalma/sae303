// Variables globales pour stocker les données et le groupe de marqueurs
let allCinemas = [];
let markers;

async function afficherCinemas() {

    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'block';

    try {
        // Initialisation du groupe de marqueurs
        // On vérifie si le plugin MarkerCluster est bien chargé, sinon on utilise un groupe simple
        if (L.MarkerClusterGroup) {
            markers = new L.MarkerClusterGroup();
        } else {
            markers = L.featureGroup();
        }

        const reponse = await fetch("./geo-cinemas.json");

        if (!reponse.ok) {
            throw new Error(`Erreur HTTP ! statut : ${reponse.status}`);
        }

        allCinemas = await reponse.json();
        
        // Affichage initial de tous les cinémas
        updateMap(allCinemas);

        // Affichage du graphique (statistiques)
        displayChart(allCinemas);
        displayCapacityChart(allCinemas);
              
        if (loading) loading.style.display = 'none';

    } catch(error) {
        console.error("Erreur lors du chargement des cinémas :", error);
        // Message d'aide explicite pour l'erreur fréquente en local
        alert("Erreur : Impossible de charger les données.\n\nSi vous êtes en local (file://), utilisez un serveur web (ex: Live Server sur VSCode).");
        if (loading) loading.style.display = 'none';
    }
}

// Fonction pour mettre à jour la carte avec une liste donnée de cinémas
function updateMap(cinemasList) {
    // Si la carte ou le groupe de marqueurs n'existe pas, on ne fait rien
    // 'map' est défini globalement dans index.html
    if (typeof map === 'undefined' || !markers) return;

    // On retire tous les marqueurs actuels de la carte
    markers.clearLayers();

    cinemasList.forEach(cinema => {
        if(cinema.geo) {
            const [lat, lng] = cinema.geo.split(',').map(Number);

            // Vérification que les coordonnées sont valides
            if (!isNaN(lat) && !isNaN(lng)) {
                const marker = L.marker([lat, lng])
                    .bindPopup(`<b>${cinema.nom}</b><br>${cinema.commune} (${cinema.dep})<br>${cinema.fauteuils} fauteuils<br>${cinema.ecrans} ecran(s)`);
                    
                markers.addLayer(marker); 
            }
        }
    });

    // On ajoute le groupe de marqueurs à la carte
    map.addLayer(markers);
    
    // On ajuste le zoom pour voir tous les marqueurs (s'il y en a)
    if (markers.getLayers().length > 0) {
        map.fitBounds(markers.getBounds());
    }
}

// Gestion de la barre de recherche
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const resultsInfo = document.getElementById('results-info');

if (searchBtn) {
    searchBtn.addEventListener('click', () => {
        const searchTerm = searchInput.value.trim().toLowerCase();

        if (searchTerm === "") {
            resultsInfo.innerHTML = "<p style='color: red; text-align: center;'>Veuillez entrer un nom de ville.</p>";
            return;
        }

        // On filtre la liste complète des cinémas
        const filteredCinemas = allCinemas.filter(cinema => {
            const commune = cinema.commune ? cinema.commune.toLowerCase() : '';
            const nom = cinema.nom ? cinema.nom.toLowerCase() : '';
            
            // On garde le cinéma si la ville OU le nom contient le terme de recherche
            return commune.includes(searchTerm) || nom.includes(searchTerm);
        });

        // On met à jour la carte avec les résultats filtrés
        updateMap(filteredCinemas);
        
        // On affiche les informations détaillées sous la carte
        displayResults(filteredCinemas);

        // On met à jour les graphiques avec les résultats filtrés
        displayChart(filteredCinemas);
        displayCapacityChart(filteredCinemas);
    });
}

// Gestion des filtres de graphiques (Onglets)
const btnEntrees = document.getElementById('btn-entrees');
const btnCapacite = document.getElementById('btn-capacite');
const chartEntrees = document.getElementById('chart-entrees');
const chartCapacite = document.getElementById('chart-capacite');

if (btnEntrees && btnCapacite) {
    btnEntrees.addEventListener('click', () => {
        chartEntrees.style.display = 'block';
        chartCapacite.style.display = 'none';
        
        btnEntrees.classList.add('active');
        btnCapacite.classList.remove('active');
    });

    btnCapacite.addEventListener('click', () => {
        chartEntrees.style.display = 'none';
        chartCapacite.style.display = 'block';
        
        btnCapacite.classList.add('active');
        btnEntrees.classList.remove('active');

        // Petite astuce : on force le redimensionnement du graphique quand il devient visible
        const chartInstance = Chart.getChart("myChart2");
        if (chartInstance) chartInstance.resize();
    });
}

function displayResults(cinemasList) {
    if (!resultsInfo) return;

    if (cinemasList.length === 0) {
        resultsInfo.innerHTML = "<p>Aucun cinéma trouvé pour cette recherche.</p>";
        return;
    }

    let htmlContent = `<h3>${cinemasList.length} cinéma(s) trouvé(s)</h3>`;
    
    cinemasList.forEach(cinema => {
        htmlContent += `
            <div class="cinema-item">
                <h4>${cinema.nom}</h4>
                <p><strong>Adresse :</strong> ${cinema.adresse}, ${cinema.code_insee} ${cinema.commune}</p>
                <p><strong>Écrans :</strong> ${cinema.ecrans} | <strong>Fauteuils :</strong> ${cinema.fauteuils}</p>
            </div>
        `;
    });

    resultsInfo.innerHTML = htmlContent;
}

function displayChart(cinemasList) {
    const ctx = document.getElementById('myChart');
    if (!ctx) return;

    // Si un graphique existe déjà, on le détruit pour éviter les bugs
    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();

    // 1. Trier les cinémas par nombre d'entrées (décroissant) et garder le Top 10
    const topCinemas = [...cinemasList]
        .sort((a, b) => b.entrees - a.entrees)
        .slice(0, 10);

    // 2. Création du graphique
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topCinemas.map(cinema => cinema.nom),
            datasets: [{
                label: 'Nombre d\'entrées annuelles',
                data: topCinemas.map(cinema => cinema.entrees),
                backgroundColor: '#FF6384',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y', // Barres horizontales
            responsive: true,
            // Ajout de l'interactivité au clic
            onClick: (evt, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const selectedCinema = topCinemas[index];
                    updateMap([selectedCinema]); // Affiche le cinéma sur la carte
                    displayResults([selectedCinema]); // Affiche ses détails en dessous
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Top 10 des cinémas les plus fréquentés'
                }
            }
        }
    });
}

function displayCapacityChart(cinemasList) {
    const ctx = document.getElementById('myChart2');
    if (!ctx) return;

    // Si un graphique existe déjà, on le détruit
    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();

    // 1. Trier les cinémas par nombre de fauteuils (décroissant)
    const topCinemas = [...cinemasList]
        .sort((a, b) => b.fauteuils - a.fauteuils)
        .slice(0, 10);

    // 2. Création du graphique
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topCinemas.map(cinema => cinema.nom),
            datasets: [{
                label: 'Capacité (Nombre de fauteuils)',
                data: topCinemas.map(cinema => cinema.fauteuils),
                backgroundColor: '#4BC0C0', // Couleur différente (Vert turquoise)
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y', // Barres horizontales
            responsive: true,
            // Ajout de l'interactivité au clic
            onClick: (evt, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const selectedCinema = topCinemas[index];
                    updateMap([selectedCinema]); // Affiche le cinéma sur la carte
                    displayResults([selectedCinema]); // Affiche ses détails en dessous
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Top 10 des plus grands cinémas (Capacité)'
                }
            }
        }
    });
}
  
afficherCinemas();
