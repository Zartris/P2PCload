define({ "api": [
  {
    "type": "get",
    "url": "/api/kademlia/nodes/:id",
    "title": "Retrieves the k closest nodes to the specified ID.",
    "name": "FindNodes",
    "group": "Milestone1",
    "version": "1.0.0",
    "description": "<p>Corresponds to the Kademlia FIND_NODE as specified in the specification.</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "node_address",
            "description": "<p>description</p>"
          },
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "node_port",
            "description": "<p>description</p>"
          },
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "node_id",
            "description": "<p>description</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Request-Example (Headers):",
          "content": "{ node_address: 192.168.0.102, node_port: 3000, node_id: 101 }",
          "type": "String"
        }
      ]
    },
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "id",
            "description": "<p>The ID of the node you want the k closest nodes to.</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "200": [
          {
            "group": "200",
            "type": "Triple[]",
            "optional": false,
            "field": "array",
            "description": "<p>the k closest nodes</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Success-Response-Example:",
          "content": "[{ ip = \"192.168.0.102\", port = 3000, id = 101 }, { ip = \"192.168.0.102\", port = 3001, id = 155  }]",
          "type": "Triple[]"
        }
      ]
    },
    "filename": "temp_for_doc/app.js",
    "groupTitle": "Milestone1"
  },
  {
    "type": "post",
    "url": "/api/kademlia/ping",
    "title": "Pings the node.",
    "name": "Ping",
    "group": "Milestone1",
    "version": "1.0.0",
    "description": "<p>Corresponds to the Kademlia PING as specified in the specification. Returns a PONG (status 200). Puts the requester in this node's bucket.</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "node_address",
            "description": "<p>description</p>"
          },
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "node_port",
            "description": "<p>description</p>"
          },
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "node_id",
            "description": "<p>description</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Request-Example (Headers):",
          "content": "{ node_address: 192.168.0.102, node_port: 3000, node_id: 101 }",
          "type": "String"
        }
      ]
    },
    "filename": "temp_for_doc/app.js",
    "groupTitle": "Milestone1"
  },
  {
    "type": "get",
    "url": "/WoT/sensors/:id",
    "title": "Retrieves the current state of a given actuator",
    "name": "GetActuator",
    "group": "Milestone2",
    "version": "1.0.0",
    "description": "<p>&quot;Gets&quot; an actuator based on an index, including the pin and description</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "id",
            "description": "<p>actuator-id</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Request-Example (Headers):",
          "content": "{ id: 6 }",
          "type": "String"
        }
      ]
    },
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "id",
            "description": "<p>The ID of the actuator you want data of from</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "200": [
          {
            "group": "200",
            "type": "Sensor",
            "optional": false,
            "field": "The",
            "description": "<p>actuator-object</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Success-Response-Example:",
          "content": "{ actuator = <actuator.toString>, pin = 4, description = \"An LED\"}",
          "type": "Sensor"
        }
      ]
    },
    "filename": "temp_for_doc/WoT.js",
    "groupTitle": "Milestone2"
  },
  {
    "type": "get",
    "url": "/WoT/sensors/:id",
    "title": "Retrieves the current state of a given sensor",
    "name": "GetSensor",
    "group": "Milestone2",
    "version": "1.0.0",
    "description": "<p>&quot;Gets&quot; a sensor based on an index, including the pin, description and latest measured value</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "id",
            "description": "<p>Sensor-id</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Request-Example (Headers):",
          "content": "{ id: 4 }",
          "type": "String"
        }
      ]
    },
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "id",
            "description": "<p>The ID of the sensor you want data of from</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "200": [
          {
            "group": "200",
            "type": "Sensor",
            "optional": false,
            "field": "The",
            "description": "<p>sensor-object</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Success-Response-Example:",
          "content": "{ sensor = <sensor.toString>, pin = 4, description = \"A temperature sensor\", latestValue = 22.06}",
          "type": "Sensor"
        }
      ]
    },
    "filename": "temp_for_doc/WoT.js",
    "groupTitle": "Milestone2"
  },
  {
    "type": "post",
    "url": "/WoT/actuators/:id/write",
    "title": "Writes to actuator",
    "name": "WriteTo",
    "group": "Milestone2",
    "version": "1.0.0",
    "description": "<p>Writes to the actuator specified in the id of the URL</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "writeData",
            "description": "<p>The data being written</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Request-Example (Headers):",
          "content": "{ writeData: 25 }",
          "type": "String"
        }
      ]
    },
    "filename": "temp_for_doc/WoT.js",
    "groupTitle": "Milestone2"
  }
] });
