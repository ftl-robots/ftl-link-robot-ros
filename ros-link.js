const EventEmitter = require("events");
const rosnodejs = require("rosnodejs");
const DiagnosticMsgs = rosnodejs.require("diagnostic_msgs");

// ROS Message Types
const DiagnosticStatus = DiagnosticMsgs.msg.DiagnosticStatus;

class RosLink extends EventEmitter {
    constructor() {
        super();
        this.d_rosNodeHandle = null;
        this.d_readyP = null;
        this.d_outputSub = null;
        this.d_inputPub = null;
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
                });
    }

    isReady() {
        return this.d_rosNodeHandle !== null;
    }

    advertiseInputsChanged(type, changeSet) {

    }

    _ensureReady() {
        if (!this.d_readyP) {
            return Promise.reject(new Error("Node not initialized!"));
        }
        return this.d_readyP;
    }
}

module.exports = RosLink;