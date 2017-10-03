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
    constructor(pin, desc, updateCallback) {

        this.sensor = Gpio(pin, "in", "both")
        this.pin = pin
        this.description = desc;
        this.latestValue = 0;
        var that = this;	
        var updateCallback = updateCallback;

        // Temp setup
        if (this.description === "HM") {
            winston.debug("Setting up temp");
            var interval = setInterval(function() {
                var readOut = sensorLib.read();
                // Only read temp.
                that.latestValue = readOut.temperature;
                winston.debug("Updated temp sensor: " + that.latestValue);

                // Call updateCallback if it's there.
                if (that.updateCalback !== undefined) {
                    that.updateCalback(that.latestValue)                    
                }
            }, 2000);
        } else {

        
            this.sensor.watch((err, value) => {
                winston.debug("Read value for sensor " + this.description + " __ " + value)
                if(err){
                    winston.error("Sensor error " + err)
                }
                else this.latestValue = value

                if (that.updateCalback !== undefined) {
                    that.updateCalback(that.latestValue)                    
                }     
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

const id = Math.floor(Math.random()*Math.pow(2,8));


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

/**
 * 
 * @api {get} /WoT/sensors/:id  Retrieves the current state of a given sensor
 * @apiName GetSensor
 * @apiGroup Milestone2
 * @apiVersion 1.0.0
 * @apiDescription "Gets" a sensor based on an index, including the pin, description and latest measured value

 * 
 * @apiHeader {String} id Sensor-id
 * 
 * 
 * @apiHeaderExample {String} Request-Example (Headers):
   { id: 4 }
 * 
 * @apiParam  {String} id The ID of the sensor you want data of from
 * @apiSuccess (200) {Sensor} The sensor-object
 * 
 * @apiSuccessExample {Sensor} Success-Response-Example:
    { sensor = <sensor.toString>, pin = 4, description = "A temperature sensor", latestValue = 22.06}
 *
 */
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

/**
 * 
 * @api {get} /WoT/sensors/:id  Retrieves the current state of a given actuator
 * @apiName GetActuator
 * @apiGroup Milestone2
 * @apiVersion 1.0.0
 * @apiDescription "Gets" an actuator based on an index, including the pin and description

 * 
 * @apiHeader {String} id actuator-id
 * 
 * 
 * @apiHeaderExample {String} Request-Example (Headers):
   { id: 6 }
 * 
 * @apiParam  {String} id The ID of the actuator you want data of from
 * @apiSuccess (200) {Sensor} The actuator-object
 * 
 * @apiSuccessExample {Sensor} Success-Response-Example:
    { actuator = <actuator.toString>, pin = 4, description = "An LED"}
 *
 */
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

/**
 * 
 * @api {post} /WoT/actuators/:id/write Writes to actuator
 * @apiName WriteTo
 * @apiGroup Milestone2
 * @apiVersion 1.0.0
 * @apiDescription Writes to the actuator specified in the id of the URL
 * 
 * @apiHeader {String} writeData The data being written
 * 
 * 
 * @apiHeaderExample {String} Request-Example (Headers):
   { writeData: 25 }
 * 
 */
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



app.post("/wot/register", (req, res, next) => {
    
    // Extract the new IP and port that this wot device should report to.
    const newIp = req.body.ip;
    const newPort = req.body.port;

    // Setup new updateCallback for all sensors.
    const newUpdateCallback = (newData) => {
        // Report to the responsible wot ds. Set 'isIterative' flag to true which causes the wot ds node to replicate the data.
        let options = {
            uri: "http://" + newIp + ":" + newPort + "/api/ds/storage",
            method: "POST",
            headers: {
                "id": Math.floor(Math.random()*Math.pow(2,8)) //TODO: This is a placeholder. Replace this with actual safe randomizer,
            },
            body: JSON.stringify({"sensorData": newData, "isIterative": true, "wotId": id, "wotIp": ip.address}),            
            json: true
        };

        request(options, (err,res,body) => {
            if (err !== undefined) {
                winston.debug(err);
                return;
            }

            winston.debug("Wot " + id + " sent data: " + newData + " to " + newIp + ":" + newPort);
        });
    }

    // Assign the callback to all sensors.
    sensors.forEach((sensor) => {
        sensor.callback = newUpdateCallback;
    });
    
    res.sendStatus(200);
})


process.on('SIGINT', () => {
    winston.info("Sensors properly disabled")
    actuators.forEach((x) => x.deregister())
    sensors.forEach((x) => x.deregister())   
    process.exit();
  });
