const EventEmitter = require("events");
const rosnodejs = require("rosnodejs");
const DiagnosticMsgs = rosnodejs.require("diagnostic_msgs");

// ROS Message Types
const DiagnosticStatus = DiagnosticMsgs.msg.DiagnosticStatus;
const KeyValue = DiagnosticMsgs.msg.KeyValue;

const PUBLISH_INTERVAL_MS = 50;

/**
 * Robot-side FTL Link node that connects to ROS
 */
class ROSLink extends EventEmitter {
    constructor() {
        super();
        this.d_rosNodeHandle = null;
        this.d_readyP = null;
        this.d_outputSub = null;
        this.d_inputPub = null;

        this.d_publishQueueInterval = null;
        this.d_publishQueue = [];
    }

    start() {
        // Initialize the rosnode
        this.d_readyP =
            rosnodejs.initNode("ftl_robot")
                .then(() => {
                    this.d_rosNodeHandle = rosnodejs.nh;
                    return this.d_rosNodeHandle;
                })
                .then((nodeHandle) => {
                    // Set up the publishers and subscribers
                    this.d_outputSub =
                        nodeHandle.subscribe("ftl_hardware_outputs", DiagnosticStatus, (msg) => {
                            var validMsg = false;
                            var outputEvt = {};
                            switch (msg.name) {
                                case "pwmOut": {
                                    outputEvt.type = "pwm";
                                    var pwmValueMap = {};
                                    msg.values.forEach(elt => {
                                        var port = parseInt(elt.key, 10);
                                        var value = parseFloat(elt.value);
                                        pwmValueMap[port] = value;
                                    });
                                    outputEvt.values = pwmValueMap;
                                    validMsg = true;
                                } break;
                                case "digitalOut": {
                                    outputEvt.type = "digital";
                                    var digitalValueMap = {};
                                    msg.values.forEach(elt => {
                                        var port = parseInt(elt.key, 10);
                                        var value = (elt.value === "true") ||
                                                    (elt.value === "1");
                                        digitalValueMap[port] = value;
                                    });
                                    outputEvt.values = digitalValueMap;
                                    validMsg = true;
                                } break;
                            }

                            if (validMsg) {
                                this.emit("outputsChanged", outputEvt);
                            }
                        });

                    this.d_inputPub = nodeHandle.advertise("ftl_hardware_inputs", DiagnosticStatus);

                    // Set up the sending interval
                    setInterval(() => {
                        if (this.d_publishQueue.length > 0) {
                            this.d_publishQueue.forEach((msg) => {
                                this.d_inputPub.publish(msg);
                            });

                            this.d_publishQueue = [];
                        }
                    }, PUBLISH_INTERVAL_MS);
                });
    }

    isReady() {
        return this.d_rosNodeHandle !== null;
    }

    advertiseInputsChanged(type, changeSet) {
        if (type !== "analog" && type !== "digital") {
            return;
        }

        if (!this.isReady()) {
            return;
        }

        // Generate the DiagnosticStatus message and queue it
        var msg = new DiagnosticStatus();
        msg.name = type;

        switch (type) {
            case "analog": {
                Object.keys(changeSet).forEach((port) => {
                    var kv = new KeyValue();
                    kv.key = port.toString();
                    kv.value = changeSet[port].toString();
                    msg.values.push(kv);
                });
            } break;
            case "digital": {
                Object.keys(changeSet).forEach((port) => {
                    var kv = new KeyValue();
                    kv.key = port.toString();
                    kv.value = changeSet[port] ? "1" : "0";
                    msg.values.push(kv);
                });
            } break;
        }

        this.d_publishQueue.push(msg);
    }

    _ensureReady() {
        if (!this.d_readyP) {
            return Promise.reject(new Error("Node not initialized!"));
        }
        return this.d_readyP;
    }
}

/**
 * Outputs Changed event
 *
 * This event is fired when any output (PWM, digital, analog etc) is changed
 * @event ROSLink#outputsChanged
 * @type {object}
 * @property {string} type The type of output that was changed
 * @property {object} values KeyValue map of port number to output value
 */

module.exports = ROSLink;