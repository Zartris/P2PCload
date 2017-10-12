const express = require('express');
const ip = require("ip");
const winston = require("winston");
const request = require("request");
const bodyParser = require("body-parser");
const onoff = require("onoff");
const apidoc = require("apidoc");
const fs = require("fs");
const Sensor = require("./sensor.js");
const Actuator = require("./actuator.js");

// DHT sensor setup
const sensorLib = require('node-dht-sensor');
sensorLib.initialize(22, 18);

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
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use("/static", express.static("/public"));


app.listen(port, () => {
    console.log('WoT node listening on port ' + port + ", with ip " + ip.address())
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


/**
 * 
 * @api {post} /wot/register Register data storage to WoT device
 * @apiName Register data storage
 * @apiGroup Milestone4
 * @apiVersion 1.0.2
 * @apiDescription Tells the WoT device which data storage device that it should report to. The parameters should be provided in a post body.
 * 
 * @apiParam {String} ip The IP of the data storage instance.
 * @apiParam {String} port The port of the data storage instance.
 */
app.post("/wot/register", (req, res, next) => {
    
    // Extract the new IP and port that this wot device should report to.
    const newIp = req.body.ip;
    let newPort = req.body.port;

	if (newPort > 3000) newPort -= 1000;	

    // Setup new updateCallback for all sensors.
    const newUpdateCallback = (newData) => {
	winston.info("starting report");
        // Report to the responsible wot ds. Set 'isIterative' flag to true which causes the wot ds node to replicate the data.
        let options = {
            uri: "http://" + newIp + ":" + newPort + "/api/ds/storage",
            method: "POST",
            headers: {
                "id": Math.floor(Math.random()*Math.pow(2,8)) //TODO: This is a placeholder. Replace this with actual safe randomizer,
            },
            body: {"timestamp": Date.now() ,"sensorData": newData, "isIterative": true, "wotId": id, "wotIp": ip.address(), "wotPort": port},            
            json: true
        };

        request(options, (err,res,body) => {
            if (err !== undefined && err !== null) {
		 for (i = 0; i < sensors.length; i++) {
        		let sensor = sensors[i];
        		sensor.updateCallback = undefined;
			winston.info("assigned callback to undefined");
   		 }
                winston.debug(err);
                return;
            }

            winston.info("Wot " + id + " sent data: " + newData + " to " + newIp + ":" + newPort);
        });
    }

    // Assign the callback to all sensors.
    //sensors.forEach((sensor) => {
    //    sensor.callback = newUpdateCallback;
    //}, this);
    for (i = 0; i < sensors.length; i++) {
        let sensor = sensors[i];
        sensor.updateCallback = newUpdateCallback;
	winston.info("assigned new callback");
    }

    winston.info("Succesfully registered new  ds node: " + newIp + ":" + newPort);	
    res.sendStatus(200);
})


process.on('SIGINT', () => {
    winston.info("Sensors properly disabled")
    actuators.forEach((x) => x.deregister())
    sensors.forEach((x) => x.deregister())   
    process.exit();
  });
