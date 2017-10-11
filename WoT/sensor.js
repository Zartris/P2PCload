module.exports = class Sensor {
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
		winston.info("Before callback in sensor class");
                if (that.updateCallback !== undefined) {
                    that.updateCallback(that.latestValue)                    
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