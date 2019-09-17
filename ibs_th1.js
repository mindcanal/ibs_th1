'use strict';

const noble = require('noble');

class IBS_TH1 {

  constructor() {
  }

  /**
   * @param {Buffer} buffer
   */
  static getCrc16(buffer) {
    let crc16 = 0xffff;
    for (let byte of buffer) {
      crc16 ^= byte;
      for (let i = 0; i < 8; i++) {
	const tmp = crc16 & 0x1;
	crc16 >>= 1;
	if (tmp) {
	  crc16 ^= 0xa001;
	}
      }
    }
    return crc16;
  }

  /**
   * @param {Peripheral} peripheral
   * @param {function(IBS_TH1.Data)} callback
   */
  onRealtimeDataReceived_(peripheral, callback) {
    if (peripheral.advertisement.localName != IBS_TH1.DEVICE_NAME) {
      return;
    }
    const buffer = peripheral.advertisement.manufacturerData;
    if (!buffer || buffer.byteLength != 9) {
      return;
    }

    const expectedCrc16 = buffer[6] * 256 + buffer[5];
    if (expectedCrc16 != IBS_TH1.getCrc16(buffer.slice(0, 5))) {
      const realtimeData = new IBS_TH1.Data(peripheral.uuid);
      realtimeData.error = 'CRC error';
      callback(realtimeData);
      return;
    }

    const temperature_raw_value = buffer[1] * 256 + buffer[0];
    const temperature = temperature_raw_value >= 0x8000 ? (temperature_raw_value - 0x10000) / 100 : temperature_raw_value / 100;
    const humidity = (buffer[3] * 256 + buffer[2]) / 100;
    const probeType =
	  buffer[4] == 0 ? IBS_TH1.ProbeTypeEnum.BUILT_IN :
	  buffer[4] == 1 ? IBS_TH1.ProbeTypeEnum.EXTERNAL :
	  IBS_TH1.ProbeTypeEnum.UNKNOWN;
    const battery = buffer[7];
    const productionTestData = buffer[8];
    const realtimeData = new IBS_TH1.Data(peripheral.uuid);
    realtimeData.temperature = temperature;
    realtimeData.humidity = humidity;
    realtimeData.probeType = probeType;
    realtimeData.battery = battery;
    callback(realtimeData);
  }

  start() {
    console.error('IBS_TH1.start() is replaced by subscribeRealtimeData().');
    process.exit(1);
  }

  stop() {
    console.error('IBS_TH1.stop() is replaced by unsubscribeRealtimeData().');
    process.exit(1);
  }

  /**
   * @param {function(IBS_TH1.Data)} callback
   */
  subscribeRealtimeData(callback) {
    const scanStart = callback => {
      noble.on('discover', peripheral => {
	this.onRealtimeDataReceived_(peripheral, callback);
      });
      noble.startScanning([IBS_TH1.SERVICE_UUID], true /*allowDuplicates*/);
    };

    if (noble.state === 'poweredOn') {
      scanStart(callback);
    } else {
      noble.on('stateChange', () => {
	scanStart(callback);
      });
    }
  }

  unsubscribeRealtimeData() {
    noble.stopScanning();
  }
}

IBS_TH1.Data = class {
  constructor(uuid) {
    this.uuid = uuid;
    this.date = new Date();
    this.temperature = null;
    this.humidity = null;
    this.probeType = IBS_TH1.ProbeTypeEnum.UNKNOWN;
    this.battery = null;
    this.error = null;
  }
}

// Device name for IBS-TH1 and IBS-TH1 mini.
IBS_TH1.DEVICE_NAME = 'sps';
IBS_TH1.SERVICE_UUID = 'fff0';

IBS_TH1.ProbeTypeEnum = {
    UNKNOWN: 0,
    BUILT_IN: 1,
    EXTERNAL: 2,
};

module.exports = IBS_TH1;
