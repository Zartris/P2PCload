const express = require('express');
const winston = require("winston");
const request = require("request");
const bodyParser = require("body-parser");
const onoff = require("onoff")
const apidoc = require("apidoc")
const fs = require("fs")

// DHT sensor setup
const sensorLib = require('node-dht-sensor');
sensorLib.initialize(22, 18);


class Sensor {
    constructor(pin, desc) {

        this.sensor = Gpio(pin, "in", "both")
        this.pin = pin
        this.description = desc;
        this.latestValue = 0;
	var that = this;	

	// Temp setup
	if (this.description === "HM") {
		winston.debug("Setting up temp");
		var interval = setInterval(function() {
			var readOut = sensorLib.read();
			// Only read temp.
			that.latestValue = readOut.temperature;
			winston.debug("Updated temp sensor: " + that.latestValue);
		}, 2000);
	} else {

	
        this.sensor.watch((err, value) => {
		winston.debug("Read value for sensor " + this.description + " __ " + value)
            if(err){
                winston.error("Sensor error " + err)
            }
            else this.latestValue = value
        })
	}
	
    }

    deregister() {
        this.sensor.unexport()
    }

    toString() {
            return actuator.toString()
    }
}

class Actuator {
    constructor(pin, desc) {
        this.actuator = new Gpio(pin, "out")
        this.pin = pin
        this.description = desc;
    }

    deregister() {
        this.actuator.unexport()
    }

    writeTo(value, callback) {
        this.actuator.write(value, callback)
    }

    toString() {
        return this.actuator.toString()
    }
}

const app = express();

var Gpio = onoff.Gpio
const port = process.argv[2] ? parseInt(process.argv[2]) : 3003;
var actuators = []
var sensors = []

winston.level = "debug";
winston.debug("Logging in debug mode");

//TODO: Do something clever to recognize devices
// One way to do this: A config file!
const config = require("./WoTConfig.json")
config.actuators.forEach((x) => actuators.push(new Actuator(x.pin, x.description)))
config.sensors.forEach((x) => sensors.push(new Sensor(x.pin, x.description)))

winston.debug(sensors);

app.set("view engine", "pug");
app.use(bodyParser.urlencoded({extended: true}));
app.use("/static", express.static("/public"));


app.listen(port, () => {
    console.log('WoT node listening on port ' + port + "!")
})

app.get("/WoT/sensors/:id", (req, res) => {
    let reqID = (req.params["id"])
    let reqSensor = sensors[reqID]

	winston.debug(reqSensor);

    if(req.header("Accept") === "application/json") {
        res.send(JSON.stringify(reqSensor))
    }
    else {
        res.render("sensor", {
            rSensor: reqSensor
        });
    }
})

app.get("/WoT/actuators/:id", (req, res) => {
    let reqID = (req.params["id"])
    let reqActuator = actuators[reqID]
    if(req.header("Accept") === "application/json") {
        res.send(JSON.stringify(reqActuator))
    }
    else {
        res.render("actuator", {
            rActuator: reqActuator,
            id: reqID
        });
    }
})

app.post("/WoT/actuators/:id/write", (req, res) => {
    let reqID = (req.params["id"])
    let reqActuator = actuators[reqID]
    let data = undefined
    if(req.body === undefined) {
	data = req.header("writeData")
winston.debug("Header if:" + data)
    } else {
winston.debug(req.body);
	 data = req.body["writeData"];	
	winston.debug("Body if:" + data)
    }
    winston.debug(reqActuator.actuator.readSync());
//	reqActuator.actuator.writeSync(1);
// winston.debug(reqActuator.actuator.readSync());

    reqActuator.writeTo(parseInt(data), () => {
	
    winston.debug(reqActuator.actuator.readSync());

        winston.info("Data written to actuator number " + reqID + ": " + data)
	res.sendStatus(200);
    })

})

app.get("/WoT", (req, res) => {
    if(req.header("Accept") === "application/json") {
        res.send(JSON.stringify(sensors))
    }
    else {
        res.render("WoT-devices", {
            rSensors: sensors,
            rActuators: actuators
        });
    }
})

process.on('SIGINT', () => {
    winston.info("Sensors properly disabled")
    actuators.forEach((x) => x.deregister())
    sensors.forEach((x) => x.deregister())   
    process.exit();
  });
