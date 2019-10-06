const margin = {
    top: 10,
    right: 10,
    bottom: 20,
    left: 30
};
const width = 1600;
const height = 700;
const files = ["./static/data/world-50m.json", "./static/data/records.json"];
let redundantCountries = [10, 304]; // Greenland, Antarctica
let datasets;
let countriesData;
let rawData;
let year;
let topography;
let metricActive = "incidents";
const colors = ["#d6abd9", "#ff3fab", "#be006b", "#8bbce3", "#882e94", "#67045e", "#3e90d0", "#3a2489", "#2b0055"];
slider = d3.select("#mySlider")
playButton = d3.select("#playbuttontext")
const duration = 500
let tooltipVisible = false
let geo
let coords
let countryData

const n = Math.floor(Math.sqrt(colors.length));
const coverageScale = d3.scaleThreshold([50, 85, 100], d3.range(n));
const incidentsScale = d3.scaleThreshold([0.0001, 0.5, 1], d3.range(n));

const graticule = d3.geoGraticule();

const projection = d3
    .geoMercator()
    .scale(150)
    .rotate([-11, 0])
    .translate([width / 2, height / 2 + 150]); // Clipping out antartica

const path = d3.geoPath().projection(projection);

const svg = d3
    .select("#viz")
    .append("svg")
    .attr("id", "mapSvg")
    .attr("width", width)
    .attr("height", height)
    .append("g");

Promise.all(files.map(f => d3.json(f))).then(init);

function init(datasets) {
    countriesData = datasets[0];
    countriesData.objects.countries.geometries = countriesData.objects.countries.geometries.filter(d => !redundantCountries.includes(d.id));
    topography = topojson.feature(countriesData, countriesData.objects.countries).features
    rawData = datasets[1];
    metricsData = d3
        .nest()
        .key(d => d.year)
        .key(d => d.id)
        .object(rawData);

    // console.log("countriesData", countriesData);
    // console.log("rawData", rawData);
    // console.log("datadatadata", metricsData);
    draw();
    controlsUpdated("incidents");
}

function filterData(year, metrics) {
    // console.log("filterData");
    // console.log(year);
    // console.log(metrics);
    let data = metricsData[year];
    let dataFinal = {};
    Object.keys(data).map(id => {
        if (data[id] != null) {
            dataFinal[id] = {};
            [metrics].forEach(metric => {
                if (data[id][0][metric] != null) {
                    dataFinal[id][metric] = data[id][0][metric];
                }
            });
        }
    });
    return dataFinal;
}

function draw() {
    countries = svg
        .selectAll(".country")
        .data(topography)
        .enter()
        .append("path")
        .attr("class", "country")
        .attr("d", path)
        .attr("opacity", 1)
        .attr("fill", "#F0F0F0");
}

const getColor = countryMetrics => {
    // console.log(countryMetrics);
    if (Object.entries(countryMetrics).length === 0) return "#F0F0F0";
    let { coverage = 0, incidents = 0 } = countryMetrics;
    coverage = coverage != "null" ? coverage : null;
    incidents = incidents != "null" ? incidents : null;

    let coverageRank = coverageScale(coverage);
    let incidentsRank = incidentsScale(incidents);
    let rank = coverageRank * n + incidentsRank;
    // console.log(`coverageRank: ${coverageRank}, incidentsRank: ${incidentsRank}, rank: ${coverageRank * n + incidentsRank}, color: ${colors[rank]}`);
    return colors[rank];
};

function update(data) {
    console.log("update");
    console.log(year);

    d3.selectAll(".country")
        .on("mouseover", d => {
            tooltipVisible = true
            if (metricsData[year][d.id] != undefined) showTooltip(d, rawData);
        })
        .on("click", d => getColor)
        .on("mouseout", d => {
            d3.select("body")
                .select("#tooltip-Container")
                .transition()
                .duration(1000)
                .style("opacity", 0);

            tooltipVisible = false
        })
        .on("click", d => getColor(data[d.id]))
        .transition()
        .duration(1000)
        .attr("fill", d => {
            if (data[d.id] != null) {
                return getColor(data[d.id]);
            } else {
                return "#F0F0F0";
            }
        });
}


slider.on("input", function(d) {
    console.log("slider input")
    controlsUpdated();
    document.getElementById("year").innerHTML = this.value;
});

document.getElementById("countryDropdown").onchange = function() {
    country = document.getElementById("countryDropdown").value;
    id_ = rawData.filter(d => d.country == country)[0].id;
    console.log("country:", country)
    console.log("id:", id_)
    geo = topography.filter(d => d.id == id_).slice(-1)[0] 
    showTooltip(geo, rawData);
};

function getMetrics() {
    console.log(getMetrics);
    let metrics = [];
    if (document.querySelector('input[id="incidents"]').checked == true) {
        metrics.push("incidents");
    } else {
        metrics.filter(i => i !== "incidents");
    }
    if (document.querySelector('input[id="coverage"]').checked == true) {
        metrics.push("coverage");
    } else {
        metrics.filter(i => i !== "coverage");
    }
    return metrics;
}

function controlsUpdated() {
    year = document.getElementById("mySlider").value;
    console.log(year, metricActive);
    let dataFiltered = filterData(year, metricActive);
    update(dataFiltered);
    globalData = processGlobal(rawData);
    global_time_series("#global_time_series", globalData);
}

function processGlobal(rawData) {
    let nestedData = d3
        .nest()
        .key(d => d.year)
        .rollup(v => {
            let incidents = d3.sum(v, x => x.incidents);
            let incidents_total = d3.sum(v, x => x.incidents_total);
            let coverage = d3.mean(v, x => x.coverage);
            let population = d3.sum(v, x => x.population);
            return { incidents, incidents_total, coverage, population };
        })
        .entries(rawData);

    globalData = [];
    nestedData.forEach(d => {
        x = {};
        let { incidents, incidents_total, coverage, population } = d.value;
        x["year"] = d.key;
        x["incidents"] = incidents;
        x["incidents_total"] = incidents_total;
        x["coverage"] = coverage;
        x["population"] = population;
        globalData.push(x);
    });

    return globalData;
}

function showTooltip(d, rawData) {
    console.log("d", d)
    geo = d
    coords = getCoords("mapSvg");
    countryData = rawData.filter(x => x.id == d.id)
    time_series("#tooltip-Container", geo, year, countryData, coords);
}


playButton
    .on("click", function() {
        console.log("clicked")
        console.log("year", year)
        button = d3.select(this);
        if (button.text() == "Pause") {
            moving = false;
            clearInterval(timer);
            // timer = 0;
            button.text("Play");
        } 
        else if (button.text() == "Restart"){
            year = "1980"
            button.text("Play");
            step()
        }
        else {
            moving = true;
            timer = setInterval(step, duration * 1.5);
            button.text("Pause");
        }
    })


function step() {
    console.log("step")
    console.log("year", year)
    if (year == 2019) {
         moving = false;
        clearInterval(timer);
        // timer = 0;
         button.text("Restart");

    }
    document.getElementById("year").innerHTML = year;
    document.querySelector('input[type=range]').value = year;
    let dataFiltered = filterData(year, metricActive);
    globalData = processGlobal(rawData);
    global_time_series("#global_time_series", globalData);
    if (countryData != null) {
        time_series("#tooltip-Container", geo, year, countryData, coords);

    }
    update(dataFiltered);
    year = String(parseInt(year) + 1)
}

// TODO: store current mouseover info, resuse it when update()