// ============================================================
// ARCA - script.js
// Navegação + Firebase + gráficos + demonstração + ESP32
// ============================================================

// ============================================================
// 1. FIREBASE
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    getDatabase,
    ref,
    onValue
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";


// Configuração do projeto Firebase ARCA
const firebaseConfig = {
    apiKey: "AIzaSyC1lmcq28WPLftAEyXlXqx77kchGn_kuT0",
    authDomain: "projeto-arca-16555.firebaseapp.com",
    databaseURL: "https://projeto-arca-16555-default-rtdb.firebaseio.com",
    projectId: "projeto-arca-16555",
    storageBucket: "projeto-arca-16555.firebasestorage.app",
    messagingSenderId: "31949635862",
    appId: "1:31949635862:web:89fce6b849c33f3cdd1037"
};


// Inicializa Firebase
const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);
const auth = getAuth(firebaseApp);

console.log("Firebase inicializado no ARCA.");


// ============================================================
// 2. VARIÁVEIS
// ============================================================

let socket = null;

let demoTimer = null;

let firebaseRecebeuDados = false;

let lastTelemetry = null;


// ============================================================
// 3. DADOS DE DEMONSTRAÇÃO
// ============================================================

const demoTelemetry = {

    robot: {
        battery: 78,
        speed: 0.7,
        internalTemp: 31,
        compartment: 64,
        mode: "AUTÔNOMO"
    },

    water: {
        temperature: 24.3,
        ph: 7.2,
        turbidity: 1.8,
        oxygen: 6.4,
        conductivity: 320,
        orp: 680,
        chlorine: 0.35,
        fluoride: 0.7
    },

    gps: {
        lat: -23.5505,
        lon: -46.6333,
        speed: 0.7,
        distance: 2.4,
        satellites: 9
    }

};


// ============================================================
// 4. HISTÓRICO DOS GRÁFICOS
// ============================================================

const history = {

    tds: [
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0
    ],

    temperature: [
        23.9, 24.0, 24.1, 24.0,
        24.2, 24.1, 24.2, 24.1,
        24.2, 24.3, 24.2, 24.3
    ],

    ph: [
        7.1, 7.2, 7.2, 7.1,
        7.3, 7.2, 7.2, 7.1,
        7.2, 7.2, 7.3, 7.2
    ],

    turbidity: [
        2.1, 2.0, 1.9, 1.9,
        1.8, 1.9, 1.7, 1.8,
        1.8, 1.7, 1.8, 1.8
    ],

    oxygen: [
        6.0, 6.1, 6.2, 6.1,
        6.3, 6.2, 6.4, 6.3,
        6.4, 6.3, 6.4, 6.4
    ],

    conductivity: [
        310, 315, 318, 316,
        320, 319, 321, 318,
        322, 320, 321, 320
    ],

    orp: [
        650, 658, 665, 660,
        670, 672, 678, 675,
        680, 678, 681, 680
    ]

};


const labels24 = [
    "00h",
    "02h",
    "04h",
    "06h",
    "08h",
    "10h",
    "12h",
    "14h",
    "16h",
    "18h",
    "20h",
    "22h"
];


// ============================================================
// 5. FUNÇÕES AUXILIARES
// ============================================================

function fmt(value, decimals = 1) {

    if (
        value === null ||
        value === undefined ||
        Number.isNaN(Number(value))
    ) {
        return "--";
    }

    return Number(value).toLocaleString(
        "pt-BR",
        {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }
    );
}


function setText(id, value) {

    const element = document.getElementById(id);

    if (!element) {
        return;
    }

    element.textContent = value;
}


// ============================================================
// 6. STATUS DA CONEXÃO
// ============================================================

function setConnection(status, detail, online = false) {

    setText("connectionStatus", status);

    setText("connectionDetail", detail);

    const pill = document.querySelector(".topright .online");

    if (pill) {

        pill.textContent = online
            ? "● SISTEMA ONLINE"
            : "● SEM CONEXÃO";

        pill.classList.toggle("online", online);
    }
}


// ============================================================
// 7. NAVEGAÇÃO
// ============================================================

function showPage(page) {

    document.querySelectorAll(".page").forEach(section => {

        section.classList.remove("active");

    });


    const target = document.getElementById(
        "page-" + page
    );


    if (target) {

        target.classList.add("active");

    }


    document.querySelectorAll(
        ".nav button[data-page]"
    ).forEach(button => {

        button.classList.toggle(
            "active",
            button.dataset.page === page
        );

    });


    const crumb = document.getElementById("crumb");

    if (crumb) {

        crumb.textContent = page.toUpperCase();

    }


    const side = document.getElementById("side");

    if (side) {

        side.classList.remove("open");

    }


    // Atualiza gráficos quando uma página é aberta
    setTimeout(() => {

        window.dispatchEvent(
            new Event("resize")
        );

    }, 50);
}


// IMPORTANTE:
// Como o index.html possui onclick="showPage(...)",
// precisamos disponibilizar a função no window.

window.showPage = showPage;


// Eventos do menu

document.querySelectorAll(
    ".nav button[data-page]"
).forEach(button => {

    button.addEventListener("click", () => {

        showPage(button.dataset.page);

    });

});


// ============================================================
// 8. MENU MOBILE
// ============================================================

const hamburger = document.getElementById("hamb");

if (hamburger) {

    hamburger.addEventListener("click", () => {

        const side = document.getElementById("side");

        if (side) {

            side.classList.toggle("open");

        }

    });

}


// ============================================================
// 9. RELÓGIO
// ============================================================

function atualizarRelogio() {

    const clock = document.getElementById("clock");

    if (!clock) {
        return;
    }

    const agora = new Date();

    clock.textContent =
        agora.toLocaleTimeString("pt-BR");

}


atualizarRelogio();

setInterval(
    atualizarRelogio,
    1000
);


// ============================================================
// 10. NORMALIZAÇÃO DOS DADOS
// ============================================================

// O Firebase pode receber os dados em português:
// sensores / robo / gps
//
// Ou no formato em inglês:
// water / robot / gps

function normalizeTelemetry(data) {

    if (!data) {
        return null;
    }


    const sensores =
        data.sensores ||
        data.water ||
        {};


    const robo =
        data.robo ||
        data.robot ||
        {};


    const gps =
        data.gps ||
        {};


    return {

        robot: {

            battery:
                robo.bateria ??
                robo.battery,

            speed:
                robo.velocidade ??
                robo.speed,

            internalTemp:
                robo.temperaturaInterna ??
                robo.internalTemp,

            compartment:
                robo.compartimento ??
                robo.compartment,

            mode:
                robo.modo ??
                robo.mode ??
                "AUTÔNOMO"

        },


        water: {

            temperature:
                sensores.temperatura ??
                sensores.temperature,

            tds:
                sensores.tds,

            turbidityADC:
                sensores.turbidez_adc,

            turbidityVoltage:
                sensores.turbidez_tensao,

            turbidityNTU:
                sensores.turbidez_ntu ??
                sensores.turbidez ??
                sensores.turbidity,

            ph:
                sensores.ph,

            turbidity:
                sensores.turbidez_ntu ??
                sensores.turbidez ??
                sensores.turbidity,

            oxygen:
                sensores.oxigenio ??
                sensores.oxygen,

            conductivity:
                sensores.condutividade ??
                sensores.conductivity,

            orp:
                sensores.orp,

            chlorine:
                sensores.cloro ??
                sensores.chlorine,

            fluoride:
                sensores.fluoreto ??
                sensores.fluoride

        },


        gps: {

            lat:
                gps.latitude ??
                gps.lat,

            lon:
                gps.longitude ??
                gps.lon,

            speed:
                gps.velocidade ??
                gps.speed,

            distance:
                gps.distancia ??
                gps.distance,

            satellites:
                gps.satelites ??
                gps.satellites

        }

    };

}


// ============================================================
// 11. ATUALIZAR INTERFACE
// ============================================================

function updateTelemetry(data) {

    const telemetry =
        normalizeTelemetry(data);


    if (!telemetry) {
        return;
    }


    lastTelemetry = telemetry;


    const robot =
        telemetry.robot || {};

    const water =
        telemetry.water || {};

    const gps =
        telemetry.gps || {};


    // --------------------------------------------------------
    // BATERIA
    // --------------------------------------------------------

    if (robot.battery !== undefined) {

        const battery =
            fmt(robot.battery, 0) + "%";

        setText(
            "batteryValue",
            battery
        );

        setText(
            "robotBattery",
            battery
        );

        setText(
            "topBattery",
            battery
        );

    }


    // --------------------------------------------------------
    // VELOCIDADE
    // --------------------------------------------------------

    const speed =
        robot.speed ??
        gps.speed;


    if (speed !== undefined) {

        const speedText =
            fmt(speed, 1) + " m/s";

        setText(
            "gpsSpeedValue",
            speedText
        );

        setText(
            "mapSpeed",
            speedText
        );

    }


    // --------------------------------------------------------
    // TEMPERATURA INTERNA
    // --------------------------------------------------------

    if (
        robot.internalTemp !== undefined
    ) {

        setText(
            "internalTemp",
            fmt(robot.internalTemp, 1) + " °C"
        );

    }


    // --------------------------------------------------------
    // COMPARTIMENTO
    // --------------------------------------------------------

    if (
        robot.compartment !== undefined
    ) {

        setText(
            "compartmentValue",
            fmt(robot.compartment, 0) + "%"
        );

    }


    // --------------------------------------------------------
    // TEMPERATURA DA ÁGUA
    // --------------------------------------------------------

    if (
        water.temperature !== undefined
    ) {

        const value =
            fmt(water.temperature, 1) + " °C";

        setText(
            "temperatureValue",
            value
        );

        setText(
            "temperatureTableValue",
            value
        );

        setText(
            "temperatureWaterDuplicate",
            value
        );

        atualizarSensorAgua(
            0,
            value
        );

    }


    // --------------------------------------------------------
    // pH
    // --------------------------------------------------------

    if (
        water.ph !== undefined
    ) {

        const value =
            fmt(water.ph, 2);

        setText(
            "phValue",
            value
        );

        setText(
            "phTableValue",
            value
        );

        atualizarSensorAgua(
            1,
            value
        );

    }


    // --------------------------------------------------------
    // TDS
    // --------------------------------------------------------

    if (
        water.tds !== undefined
    ) {

        const value =
            fmt(water.tds, 0) +
            " ppm";

        setText(
            "tdsValue",
            value
        );

        setText(
            "tdsTableValue",
            value
        );

        atualizarSensorAgua(
            3,
            value
        );

    }


    // --------------------------------------------------------
    // TURBIDEZ - ADC
    // --------------------------------------------------------

    if (
        water.turbidityADC !== undefined
    ) {

        setText(
            "turbidityAdcValue",
            fmt(water.turbidityADC, 0)
        );

    }


    // --------------------------------------------------------
    // TURBIDEZ - TENSÃO
    // --------------------------------------------------------

    if (
        water.turbidityVoltage !== undefined
    ) {

        setText(
            "turbidityVoltageValue",
            fmt(water.turbidityVoltage, 3) +
            " V"
        );

        setText(
            "turbidityVoltageTableValue",
            fmt(water.turbidityVoltage, 3) +
            " V"
        );

    }


    // --------------------------------------------------------
    // TURBIDEZ
    // --------------------------------------------------------

    if (
        water.tds !== undefined
    ) {

        history.tds.push(
            Number(water.tds)
        );

        history.tds =
            history.tds.slice(-12);

    }


    if (
        water.turbidity !== undefined
    ) {

        const value =
            fmt(water.turbidity, 1) +
            " NTU";

        setText(
            "turbidityValue",
            value
        );

        setText(
            "turbidityTableValue",
            value
        );

        atualizarSensorAgua(
            2,
            value
        );

    }


    // --------------------------------------------------------
    // OXIGÊNIO
    // --------------------------------------------------------

    if (
        water.oxygen !== undefined
    ) {

        const value =
            fmt(water.oxygen, 1) +
            " mg/L";

        setText(
            "oxygenValue",
            value
        );

        setText(
            "oxygenValue",
            value
        );

    }


    // --------------------------------------------------------
    // CONDUTIVIDADE
    // --------------------------------------------------------

    if (
        water.conductivity !== undefined
    ) {

        const value =
            fmt(water.conductivity, 0) +
            " µS/cm";

        setText(
            "conductivityValue",
            value
        );

        atualizarSensorAgua(
            4,
            value
        );

    }


    // --------------------------------------------------------
    // ORP
    // --------------------------------------------------------

    if (
        water.orp !== undefined
    ) {

        const value =
            fmt(water.orp, 0) +
            " mV";

        setText(
            "orpValue",
            value
        );

        atualizarSensorAgua(
            5,
            value
        );

    }


    // --------------------------------------------------------
    // CLORO
    // --------------------------------------------------------

    if (
        water.chlorine !== undefined
    ) {

        const value =
            fmt(water.chlorine, 2) +
            " mg/L";

        setText(
            "chlorineValue",
            value
        );

        atualizarSensorAgua(
            6,
            value
        );

    }


    // --------------------------------------------------------
    // FLUORETO
    // --------------------------------------------------------

    if (
        water.fluoride !== undefined
    ) {

        const value =
            fmt(water.fluoride, 2) +
            " mg/L";

        setText(
            "fluorideValue",
            value
        );

        atualizarSensorAgua(
            7,
            value
        );

    }


    // --------------------------------------------------------
    // GPS
    // --------------------------------------------------------

    if (
        gps.lat !== undefined
    ) {

        const latitude =
            Number(gps.lat).toFixed(6);

        setText(
            "latitudeValue",
            latitude
        );

        setText(
            "mapLat",
            latitude
        );

    }


    if (
        gps.lon !== undefined
    ) {

        const longitude =
            Number(gps.lon).toFixed(6);

        setText(
            "longitudeValue",
            longitude
        );

        setText(
            "mapLon",
            longitude
        );

    }


    if (
        gps.distance !== undefined
    ) {

        const distance =
            fmt(gps.distance, 2) +
            " km";

        setText(
            "distanceValue",
            distance
        );

        setText(
            "mapDistance",
            distance
        );

    }


    if (
        gps.satellites !== undefined
    ) {

        setText(
            "satellitesValue",
            String(gps.satellites)
        );

    }


    // --------------------------------------------------------
    // HISTÓRICO
    // --------------------------------------------------------

    adicionarHistorico(water);

    atualizarGraficos();

}


// ============================================================
// 12. ATUALIZAR CARDS DA PÁGINA DE ÁGUA
// ============================================================

function atualizarSensorAgua(index, value) {

    const cards =
        document.querySelectorAll(
            ".sensor-grid .sensor"
        );


    if (!cards[index]) {
        return;
    }


    const valueElement =
        cards[index].querySelector(".value");


    if (valueElement) {

        valueElement.textContent =
            value;

    }

}


// ============================================================
// 13. HISTÓRICO
// ============================================================

function adicionarHistorico(water) {

    if (
        water.temperature !== undefined
    ) {

        history.temperature.push(
            Number(water.temperature)
        );

        history.temperature =
            history.temperature.slice(-12);

    }


    if (
        water.ph !== undefined
    ) {

        history.ph.push(
            Number(water.ph)
        );

        history.ph =
            history.ph.slice(-12);

    }


    if (
        water.turbidity !== undefined
    ) {

        history.turbidity.push(
            Number(water.turbidity)
        );

        history.turbidity =
            history.turbidity.slice(-12);

    }


    if (
        water.oxygen !== undefined
    ) {

        history.oxygen.push(
            Number(water.oxygen)
        );

        history.oxygen =
            history.oxygen.slice(-12);

    }


    if (
        water.conductivity !== undefined
    ) {

        history.conductivity.push(
            Number(water.conductivity)
        );

        history.conductivity =
            history.conductivity.slice(-12);

    }


    if (
        water.orp !== undefined
    ) {

        history.orp.push(
            Number(water.orp)
        );

        history.orp =
            history.orp.slice(-12);

    }

}


// ============================================================
// 14. GRÁFICOS
// ============================================================

const charts = {};


function createChart(
    id,
    type,
    labels,
    data,
    label
) {

    const canvas =
        document.getElementById(id);


    if (!canvas) {
        return null;
    }


    if (
        typeof Chart === "undefined"
    ) {

        console.warn(
            "Chart.js não foi carregado."
        );

        return null;

    }


    return new Chart(
        canvas,
        {

            type: type,

            data: {

                labels: labels,

                datasets: [

                    {

                        label: label,

                        data: data,

                        tension: 0.35,

                        borderWidth: 2,

                        fill: false

                    }

                ]

            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                plugins: {

                    legend: {

                        display: true

                    }

                }

            }

        }
    );

}


// ============================================================
// 15. CRIAÇÃO DOS GRÁFICOS
// ============================================================

function inicializarGraficos() {


    charts.main =
        createChart(
            "mainChart",
            "line",
            labels24,
            history.temperature,
            "Temperatura"
        );


    charts.water =
        createChart(
            "waterChart",
            "line",
            labels24,
            history.ph,
            "pH"
        );


    charts.bar =
        createChart(
            "barChart",
            "bar",
            [
                "01",
                "02",
                "03",
                "04",
                "05",
                "06",
                "07"
            ],
            [
                12,
                18,
                22,
                15,
                31,
                27,
                24
            ],
            "kg"
        );


    charts.donut =
        createChart(
            "donutChart",
            "doughnut",
            [
                "Plástico",
                "Orgânico",
                "Outros"
            ],
            [
                52,
                28,
                20
            ],
            "Resíduos"
        );


    charts.report =
        createChart(
            "reportChart",
            "line",
            labels24,
            history.ph,
            "pH"
        );


    charts.reportBar =
        createChart(
            "reportBar",
            "bar",
            [
                "Seg",
                "Ter",
                "Qua",
                "Qui",
                "Sex",
                "Sáb",
                "Dom"
            ],
            [
                18,
                22,
                27,
                19,
                31,
                28,
                25
            ],
            "kg"
        );

}


// ============================================================
// 16. ATUALIZAR GRÁFICOS
// ============================================================

function atualizarGraficos() {

    if (
        charts.main &&
        charts.main.data
    ) {

        const metric =
            document.getElementById(
                "chartMetric"
            )?.value;


        let data =
            history.temperature;

        let label =
            "Temperatura";


        if (metric === "pH") {

            data = history.ph;
            label = "pH";

        }

        else if (
            metric === "Turbidez"
        ) {

            data = history.turbidity;
            label = "Turbidez";

        }

        else if (
            metric === "TDS"
        ) {

            data = history.tds;
            label = "TDS (ppm)";

        }

        else if (
            metric === "Oxigênio dissolvido"
        ) {

            data = history.oxygen;
            label = "O₂ dissolvido";

        }

        else if (
            metric === "Condutividade"
        ) {

            data = history.conductivity;
            label = "Condutividade";

        }

        else if (
            metric === "ORP"
        ) {

            data = history.orp;
            label = "ORP";

        }


        charts.main.data.datasets[0].data =
            data;

        charts.main.data.datasets[0].label =
            label;

        charts.main.update(
            "none"
        );

    }


    if (
        charts.water
    ) {

        const metric =
            document.getElementById(
                "waterMetric"
            )?.value;


        let data =
            history.ph;

        let label =
            "pH";


        if (
            metric === "Temperatura"
        ) {

            data =
                history.temperature;

            label =
                "Temperatura";

        }

        else if (
            metric === "Turbidez"
        ) {

            data =
                history.turbidity;

            label =
                "Turbidez";

        }

        else if (
            metric === "TDS"
        ) {

            data =
                history.tds;

            label =
                "TDS (ppm)";

        }

        else if (
            metric === "O₂ dissolvido"
        ) {

            data =
                history.oxygen;

            label =
                "O₂ dissolvido";

        }

        else if (
            metric === "ORP"
        ) {

            data =
                history.orp;

            label =
                "ORP";

        }


        charts.water.data.datasets[0].data =
            data;

        charts.water.data.datasets[0].label =
            label;

        charts.water.update(
            "none"
        );

    }

}


// ============================================================
// 17. SELECT DOS GRÁFICOS
// ============================================================

document.getElementById(
    "chartMetric"
)?.addEventListener(
    "change",
    atualizarGraficos
);


document.getElementById(
    "waterMetric"
)?.addEventListener(
    "change",
    atualizarGraficos
);


// ============================================================
// 18. MODO DEMONSTRAÇÃO
// ============================================================

function startDemo() {

    stopDemo();


    updateTelemetry(
        demoTelemetry
    );


    setConnection(
        "MODO DEMONSTRAÇÃO",
        "Valores simulados para testar a interface.",
        false
    );


    demoTimer =
        setInterval(
            () => {

                // Se o Firebase já estiver
                // fornecendo dados reais,
                // não substituímos esses dados.

                if (
                    firebaseRecebeuDados
                ) {

                    return;

                }


                const data =
                    JSON.parse(
                        JSON.stringify(
                            demoTelemetry
                        )
                    );


                data.water.temperature +=
                    (Math.random() - 0.5) * 0.2;


                data.water.ph +=
                    (Math.random() - 0.5) * 0.04;


                data.water.turbidity +=
                    (Math.random() - 0.5) * 0.15;


                data.water.temperature =
                    Math.max(
                        0,
                        data.water.temperature
                    );


                data.water.ph =
                    Math.max(
                        0,
                        data.water.ph
                    );


                data.water.turbidity =
                    Math.max(
                        0,
                        data.water.turbidity
                    );


                updateTelemetry(
                    data
                );

            },

            1000
        );

}


function stopDemo() {

    if (demoTimer) {

        clearInterval(
            demoTimer
        );

    }

    demoTimer = null;

}


// ============================================================
// 19. FIREBASE - RECEBER DADOS
// ============================================================

const arcaRef =
    ref(
        database,
        "ARCA"
    );


// O site usa login anônimo apenas para leitura.
// O ESP32 continua usando a conta própria dele para escrever.
async function iniciarFirebase() {

    try {

        await signInAnonymously(auth);

        console.log(
            "Site autenticado anonimamente no Firebase."
        );

        onValue(
            arcaRef,

            snapshot => {

                const data =
                    snapshot.val();


                console.log(
                    "Dados recebidos do Firebase:",
                    data
                );


                if (!data) {

                    console.warn(
                        "O caminho /ARCA está vazio."
                    );

                    setConnection(
                        "FIREBASE CONECTADO",
                        "Conectado, mas ainda não há dados no /ARCA.",
                        true
                    );

                    return;

                }


                firebaseRecebeuDados =
                    true;


                stopDemo();


                updateTelemetry(
                    data
                );


                setConnection(
                    "FIREBASE CONECTADO",
                    "Recebendo dados da ESP32 em tempo real.",
                    true
                );

            },

            error => {

                console.error(
                    "Erro no Firebase:",
                    error
                );


                setConnection(
                    "ERRO NO FIREBASE",
                    "Não foi possível ler o Realtime Database.",
                    false
                );

            }

        );

    }

    catch (error) {

        console.error(
            "Erro na autenticação anônima:",
            error
        );

        setConnection(
            "ERRO DE AUTENTICAÇÃO",
            "Ative o provedor Anônimo no Firebase Authentication.",
            false
        );

    }

}


iniciarFirebase();


// ============================================================
// 20. WEBSOCKET - ESP32
// ============================================================

function connectWebSocket() {

    stopDemo();


    const input =
        document.getElementById(
            "wsUrl"
        );


    const url =
        input?.value?.trim() ||
        "ws://192.168.1.50:81";


    if (!url) {

        setConnection(
            "ERRO",
            "Informe o endereço do ESP32.",
            false
        );

        return;

    }


    try {

        socket =
            new WebSocket(
                url
            );

    }

    catch (error) {

        console.error(
            error
        );


        setConnection(
            "ERRO DE CONEXÃO",
            "Endereço WebSocket inválido.",
            false
        );

        return;

    }


    setConnection(
        "CONECTANDO...",
        url,
        false
    );


    socket.onopen =
        () => {

            console.log(
                "WebSocket conectado."
            );


            setConnection(
                "ESP32 CONECTADO",
                "Recebendo telemetria em tempo real.",
                true
            );


            socket.send(
                JSON.stringify(
                    {
                        type: "dashboard",
                        action: "subscribe",
                        device: "ARCA-001"
                    }
                )
            );

        };


    socket.onmessage =
        event => {

            try {

                const message =
                    JSON.parse(
                        event.data
                    );


                console.log(
                    "Mensagem do ESP32:",
                    message
                );


                if (
                    message.type === "telemetry" ||
                    message.robot ||
                    message.robo ||
                    message.water ||
                    message.sensores ||
                    message.gps
                ) {

                    updateTelemetry(
                        message
                    );

                }

            }

            catch (error) {

                console.warn(
                    "Mensagem recebida não é JSON:",
                    event.data
                );

            }

        };


    socket.onerror =
        error => {

            console.error(
                "Erro WebSocket:",
                error
            );


            setConnection(
                "ERRO DE CONEXÃO",
                "Não foi possível comunicar com o ESP32.",
                false
            );

        };


    socket.onclose =
        () => {

            console.log(
                "WebSocket desconectado."
            );


            setConnection(
                "DESCONECTADO",
                "A conexão com o ESP32 foi encerrada.",
                false
            );

        };

}


// ============================================================
// 21. API REST
// ============================================================

async function pollRest() {

    stopDemo();


    const input =
        document.getElementById(
            "apiUrl"
        );


    const base =
        input?.value?.trim() ||
        "http://192.168.1.50/api";


    const url =
        base.replace(
            /\/$/,
            ""
        ) +
        "/telemetry";


    try {

        const response =
            await fetch(
                url,
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "HTTP " +
                response.status
            );

        }


        const data =
            await response.json();


        updateTelemetry(
            data
        );


        setConnection(
            "API CONECTADA",
            "Telemetria recebida via HTTP.",
            true
        );

    }

    catch (error) {

        console.error(
            "Erro na API:",
            error
        );


        setConnection(
            "API INDISPONÍVEL",
            "Verifique o endereço da API e a rede.",
            false
        );

    }

}


// ============================================================
// 22. ENVIAR COMANDOS PARA O ROBÔ
// ============================================================

function sendRobotCommand(
    command
) {

    const payload =
        JSON.stringify(
            {
                type: "command",
                device: "ARCA-001",
                command: command
            }
        );


    if (
        socket &&
        socket.readyState ===
        WebSocket.OPEN
    ) {

        socket.send(
            payload
        );


        console.log(
            "Comando enviado:",
            command
        );


        return true;

    }


    console.warn(
        "ESP32 não conectado. Comando não enviado:",
        command
    );


    return false;

}


// ============================================================
// 23. CONTROLES DO ROBÔ
// ============================================================

const controlButtons =
    document.querySelectorAll(
        ".control button"
    );


const commands = [

    "forward-left",
    "forward",
    "forward-right",

    "left",
    "stop",
    "right",

    "back-left",
    "backward",
    "back-right"

];


controlButtons.forEach(
    (button, index) => {

        button.addEventListener(
            "click",
            () => {

                const command =
                    commands[index];


                const sent =
                    sendRobotCommand(
                        command
                    );


                if (
                    !sent &&
                    command === "stop"
                ) {

                    setConnection(
                        "SEM CONEXÃO",
                        "ESP32 não conectado.",
                        false
                    );

                }

            }
        );

    }
);


// ============================================================
// 24. PARADA DE EMERGÊNCIA
// ============================================================

const emergency =
    document.querySelector(
        ".emergency"
    );


if (emergency) {

    emergency.onclick =
        () => {

            const sent =
                sendRobotCommand(
                    "emergency_stop"
                );


            if (sent) {

                alert(
                    "Parada de emergência enviada ao robô."
                );

            }

            else {

                alert(
                    "ESP32 não conectado. Nenhum comando foi enviado."
                );

            }

        };

}


// ============================================================
// 25. BOTÃO CONECTAR
// ============================================================

document.getElementById(
    "connectBtn"
)?.addEventListener(
    "click",
    () => {

        connectWebSocket();

    }
);


// ============================================================
// 26. BOTÃO DADOS DE TESTE
// ============================================================

document.getElementById(
    "demoBtn"
)?.addEventListener(
    "click",
    () => {

        firebaseRecebeuDados =
            false;

        startDemo();

    }
);


// ============================================================
// 27. FILTROS DOS RELATÓRIOS
// ============================================================

document.querySelectorAll(
    ".reportfilters .btn"
).forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                document.querySelectorAll(
                    ".reportfilters .btn"
                ).forEach(
                    item => {

                        item.classList.remove(
                            "active"
                        );

                    }
                );


                button.classList.add(
                    "active"
                );

            }
        );

    }
);


// ============================================================
// 28. INICIALIZAÇÃO
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "Interface ARCA carregada."
        );


        inicializarGraficos();


        // Começa em modo demonstração
        // até o Firebase fornecer dados.

        startDemo();

    }
);


// ============================================================
// FIM DO SCRIPT ARCA
// ============================================================