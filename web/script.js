let reading = false;
let duration = 1; // Duration in minutes
let remainingTimeInterval = null;

function updateDuration(value) {
    duration = parseInt(value);
    document.getElementById('durationValue').innerText = `${value} минут${value > 1 ? 'ы' : 'а'}`;
}

function updateRemainingTime(seconds) {
    let minutes = Math.floor(seconds / 60);
    let secs = seconds % 60;
    document.getElementById('remainingTime').innerText = `Оставшееся время: ${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

function toggleReading() {
    reading = !reading;
    let button = document.getElementById('startReadingBtn');
    if (reading) {
        button.classList.remove('btn-primary');
        button.classList.add('btn-danger');
        button.innerText = 'Остановить чтение данных';
        let selectedPort = document.getElementById('comPortSelect').value;
        eel.start_reading(selectedPort, duration);
        let totalTime = duration * 60;
        remainingTimeInterval = setInterval(() => {
            totalTime--;
            if (totalTime <= 0) {
                clearInterval(remainingTimeInterval);
                resetButtons(); // Вызываем функцию для сброса кнопок
            }
            updateRemainingTime(totalTime);
        }, 1000);
    } else {
        button.classList.remove('btn-danger');
        button.classList.add('btn-primary');
        button.innerText = 'Начать чтение данных';
        eel.stop_reading();
        clearInterval(remainingTimeInterval);
    }
}

function resetButtons() {
    // Сбросить кнопку чтения данных в исходное состояние
    let startButton = document.getElementById('startReadingBtn');
    startButton.classList.remove('btn-danger');
    startButton.classList.add('btn-primary');
    startButton.innerText = 'Начать чтение данных';

    // Сбросить кнопку поднятия/опускания плиты в исходное состояние
    let plateButton = document.getElementById('togglePlitaBtn');
    plateButton.classList.remove('btn-success');
    plateButton.classList.add('btn-primary');
    document.getElementById('status6').innerText = 'Pin 6 is LOW';

    // Сбросить текст и класс кнопки привода в исходное состояние
    let privedButton = document.getElementById('togglePrivedBtn');
    privedButton.classList.remove('btn-success');
    privedButton.classList.add('btn-primary');
    document.getElementById('status7').innerText = 'Pin 7 is LOW';

    let plateStatusDiv = document.getElementById('plateStatus');
    plateStatusDiv.classList.remove('status-up', 'status-down');
    plateStatusDiv.classList.add('status');
}

eel.expose(updatePlateStatus);
function updatePlateStatus(status) {
    const plateStatusDiv = document.getElementById('plateStatus');
    plateStatusDiv.innerText = status;
    if (status === "Плита поднята") {
        plateStatusDiv.classList.remove('status-down', 'status');
        plateStatusDiv.classList.add('status-up');
    } else if (status === "Плита опущена") {
        plateStatusDiv.classList.remove('status-up', 'status');
        plateStatusDiv.classList.add('status-down');
    } else if (status === "Состояние плиты: неизвестно") {
        plateStatusDiv.classList.remove('status-up', 'status-down');
        plateStatusDiv.classList.add('status');
    }
}

async function togglePin(pin) {
    let response = await eel.toggle_pin(pin)();
    document.getElementById(`status${pin}`).innerText = `Pin ${pin} is ${response.state}`;
    let button = document.getElementById('toggle' + (pin == 6 ? 'Plita' : 'Prived') + 'Btn');
    let status = document.getElementById('status' + pin);
    if (button.classList.contains('btn-primary')) {
        button.classList.remove('btn-primary');
        button.classList.add('btn-success');
        status.innerText = 'Pin ' + pin + ' is HIGH';
    } else {
        button.classList.remove('btn-success');
        button.classList.add('btn-primary');
        status.innerText = 'Pin ' + pin + ' is LOW';
    }
}

window.onload = function() {
    eel.get_com_ports()(ports => {
        let comPortSelect = document.getElementById('comPortSelect');
        ports.forEach(port => {
            let option = document.createElement('option');
            option.value = port;
            option.text = port;
            comPortSelect.appendChild(option);
        });
    });

    createCharts();
}

function createCharts() {
    // Создание графика данных
    let margin = { top: 20, right: 30, bottom: 30, left: 40 };
    let width = 800 - margin.left - margin.right;
    let height = 300 - margin.top - margin.bottom;

    let svg = d3.select("#chart")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    let x = d3.scaleLinear().range([0, width]);
    let y = d3.scaleLinear().range([height, 0]);

    let line = d3.line()
        .x(d => x(d.time))
        .y(d => y(d.value));

    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append("g")
        .attr("class", "y axis")
        .call(d3.axisLeft(y));

    svg.append("path")
        .datum([])
        .attr("class", "line")
        .attr("d", line);

    // Создание графика Max/Min
    let svgMaxMin = d3.select("#maxMinChart")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    let xMaxMin = d3.scaleLinear().range([0, width]);
    let yMaxMin = d3.scaleLinear().range([height, 0]);

    let lineMaxMin = d3.line()
        .x(d => xMaxMin(d.time))
        .y(d => yMaxMin(d.value));

    svgMaxMin.append("g")
        .attr("class", "x axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xMaxMin));

    svgMaxMin.append("g")
        .attr("class", "y axis")
        .call(d3.axisLeft(yMaxMin));

    svgMaxMin.append("path")
        .datum([])
        .attr("class", "line")
        .attr("d", lineMaxMin);

    // Сохранение в глобальную переменную
    window.charts = { svg, x, y, line, svgMaxMin, xMaxMin, yMaxMin, lineMaxMin };
}

eel.expose(updateChart);
function updateChart(deviationPercent, time) {
    let { svg, x, y, line } = window.charts;

    let data = svg.datum();
    data.push({ time, value: deviationPercent });

    x.domain(d3.extent(data, d => d.time));
    y.domain(d3.extent(data, d => d.value));

    svg.select(".line")
        .datum(data)
        .attr("d", line);

    svg.select(".x.axis").call(d3.axisBottom(x));
    svg.select(".y.axis").call(d3.axisLeft(y));

    let table = document.getElementById('dataTable1').getElementsByTagName('tbody')[0];
    let row = table.insertRow();
    let number = row.insertCell(0);
    let cell_time = row.insertCell(1);
    let cell_value = row.insertCell(2);
    number.innerHTML = data.length;
    cell_time.innerHTML = time;
    cell_value.innerHTML = deviationPercent.toFixed(2);
}

eel.expose(updateMaxMinChart);
function updateMaxMinChart(time, raznica, min, max) {
    let { svgMaxMin, xMaxMin, yMaxMin, lineMaxMin } = window.charts;

    let data = svgMaxMin.datum();
    data.push({ time, value: raznica });

    xMaxMin.domain(d3.extent(data, d => d.time));
    yMaxMin.domain(d3.extent(data, d => d.value));

    svgMaxMin.select(".line")
        .datum(data)
        .attr("d", lineMaxMin);

    svgMaxMin.select(".x.axis").call(d3.axisBottom(xMaxMin));
    svgMaxMin.select(".y.axis").call(d3.axisLeft(yMaxMin));

    let table = document.getElementById('dataTable2').getElementsByTagName('tbody')[0];
    let row = table.insertRow();
    let cell_time = row.insertCell(0);
    let cell_raznica = row.insertCell(1);
    let cell_max = row.insertCell(2);
    let cell_min = row.insertCell(3);
    cell_time.innerHTML = time;
    cell_raznica.innerHTML = raznica;
    cell_max.innerHTML = max;
    cell_min.innerHTML = min;
}

function saveToExcel() {
    let table = document.getElementById('dataTable2');
    let rows = table.getElementsByTagName('tr');
    let csvContent = [];

    // Loop through rows and cells to extract data
    for (let i = 0; i < rows.length; i++) {
        let cells = rows[i].getElementsByTagName('td');
        let rowData = [];
        for (let j = 0; j < cells.length; j++) {
            rowData.push(cells[j].innerText);
        }
        csvContent.push(rowData.join(','));
    }

    // Join data into CSV format
    let csvData = csvContent.join('\n');

    // Create a blob with the CSV data
    let blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });

    // Create a link element to trigger the download
    let link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', 'min_max_data.csv');
    link.style.display = 'none';

    // Append the link to the document and click it programmatically
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
}

window.onunload = function() {
    eel.close_application();
};