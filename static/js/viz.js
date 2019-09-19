const margin = { top: 10, right: 10, bottom: 30, left: 30 };
const width = 1400;
const height = 900;
const range = (start, end) => Array.from({ length: end - start }, (v, k) => k + start);
const files = ["./static/data/world-50m.json", "./static/data/records.json"];
let datasets;
let countriesData;
let metricsData;
let rawData;
let year;
const colors = [
	"#d1d3ca",
	"#c5c692",
	"#b8ba57",
	"#aaab19",
	"#a3a7b6",
	"#999d84",
	"#8f934f",
	"#858817",
	"#767da4",
	"#6f7576",
	"#676e47",
	"#606514",
	"#4a5491",
	"#464f69",
	"#414a3f",
	"#3c4412"
];

const n = Math.floor(Math.sqrt(colors.length));
const coverageScale = d3.scaleThreshold([20, 60, 90, 100], d3.range(n));
const incidentsScale = d3.scaleThreshold([0.0001, 0.001, 0.01, 1], d3.range(n));

const graticule = d3.geoGraticule();

const projection = d3
	.geoMercator()
	.scale(width / 3.5 / Math.PI)
	.rotate([-11, 0])
	.translate([width / 2, height / 2]);

const path = d3.geoPath().projection(projection);

const svg = d3
	.select("#viz")
	.append("svg")
	.attr("width", width)
	.attr("height", height)
	.append("g");

svg.append("path")
	.datum(graticule)
	.attr("class", "graticule")
	.attr("d", path);

svg.append("path")
	.datum({ type: "Sphere" })
	.attr("class", "sphere")
	.attr("d", path)
	.attr("fill", "#f1f1f1")
	.attr("stroke", "black")
	.attr("opacity", 0.3);

Promise.all(files.map(f => d3.json(f))).then(init);

function init(datasets) {
	countriesData = datasets[0];
	rawData = datasets[1];
	metricsData = d3
		.nest()
		.key(d => d.year)
		.key(d => d.id)
		.object(rawData);

	console.log("countriesData", countriesData);
	console.log("metricsData", metricsData);
	draw();
}

function draw() {
	countries = svg
		.selectAll(".country")
		.data(topojson.feature(countriesData, countriesData.objects.countries).features)
		.enter()
		.append("path")
		.attr("class", "country")
		.attr("d", path)
		.attr("opacity", 1)
		.attr("fill", "#F0F0F0");
}

function filterData(year, metrics) {
	let data = metricsData[year];
	let dataFinal = {};
	Object.keys(data).map(id => {
		if (data[id] != null) {
			dataFinal[id] = {};
			metrics.forEach(metric => {
				if (data[id][0][metric] != null) {
					dataFinal[id][metric] = data[id][0][metric];
				}
			});
		}
	});
	return dataFinal;
}

const getColor = countryMetrics => {
	if (Object.entries(countryMetrics).length === 0) return "#F0F0F0";
	const { coverage = 0, incidents = 0 } = countryMetrics;
	console.log();

	let coverageRank = coverageScale(coverage);
	let incidentsRank = incidentsScale(incidents);
	let rank = coverageRank * n + incidentsRank;
	console.log(`coverageRank: ${coverageRank}, incidentsRank: ${incidentsRank}, rank: ${coverageRank * n + incidentsRank}, color: ${colors[rank]}`);
	return colors[rank];
};

function paint(data) {
	console.log(data);
	d3.selectAll(".country")
		.on("mouseover", d => {
			if (metricsData[year][d.id] != undefined) {
				return showTooltip(d, metricsData[year][d.id]);
			}
		})
		.on("mouseout", hideTooltip)
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

document.querySelector('input[id="incidents"]').onchange = function() {
	controlsUpdated();
};

document.querySelector('input[id="coverage"]').onchange = function() {
	controlsUpdated();
};

document.getElementById("mySlider").onchange = function() {
	controlsUpdated();
};

d3.select("#mySlider").on("input", function(d) {
	controlsUpdated();
	document.getElementById("year").innerHTML = this.value;
});

function getMetrics() {
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
	let metrics = getMetrics();
	year = document.getElementById("mySlider").value;
	let dataFiltered = filterData(year, metrics);
	paint(dataFiltered);
}

function createToolTip() {
	tooltip = d3
		.select("body")
		.select("#tooltip")
		.on("mouseover", function(d, i) {
			tooltip
				.transition()
				.duration(0)
				.style("display", "")
				.style("opacity", 0.9); // on mouse over cancel circle mouse out transistion
		})
		.on("mouseout", function(d, i) {
			hideTooltip();
		});
}

function showTooltip(dTopo, dMetrics) {
	var coords = path.centroid(dTopo);
	tooltip = d3
		.select("body")
		.select("#tooltip")
		.style("left", coords[0] + "px")
		.style("top", coords[1] + "px")
		.style("opacity", 0)
		.style("display", "");

	tooltip
		.transition()
		.duration(800)
		.style("opacity", 1);

	tooltip.html(
		`
        <div id="tooltip-Container">
            <table class="tg">
                <tr>
                    <th class="tg-yw4l" colspan="3">
                        <div class="tooltip-planet">${dMetrics.country}</div>
                        <div class="tooltip-rule"></div>
                        <div class="tooltip-year">Year: ${year}</div>
                        <div class="tooltip-year">Population: ${nFormatter(dMetrics.population)}</div>
                        <div class="tooltip-year">Polio Incidents: ${dMetrics.incidents} per 100k</div>
                        <div class="tooltip-year">Vaccine Coverage: ${dMetrics.coverage}%</div>
                    </th>
                </tr>
            </table>
        </div>
        `
	);
}

function hideTooltip() {
	d3.select("body")
		.select("#tooltip")
		.transition()
		.duration(500)
		.style("opacity", 0)
		.transition()
		.duration(1)
		.style("display", "None");
	// .style("left", 0 + "px")
	// .style("top", 0 + "px");
}

var chart = timeSeriesChart()
	.x(function(d) {
		return formatDate.parse(d.date);
	})
	.y(function(d) {
		return +d.price;
	});
