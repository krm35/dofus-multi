const BIT_RIGHT_SHIFT_LEN_PACKET_ID = 2;

function computeTypeLen(len) {
    if (len > 65535) {
        return 3;
    }
    if (len > 255) {
        return 2;
    }
    if (len > 0) {
        return 1;
    }
    return 0;
}

function subComputeStaticHeader(msgId, typeLen) {
    return msgId << BIT_RIGHT_SHIFT_LEN_PACKET_ID | typeLen;
}

module.exports = (output, id, data, packetCounter) => {
    let high = 0;
    let low = 0;
    const {length} = data.buffer;
    const typeLen = computeTypeLen(length);
    output.writeShort(subComputeStaticHeader(id, typeLen));
    if (packetCounter) output.writeUnsignedInt(packetCounter);
    switch (typeLen) {
        case 0:
            break;
        case 1:
            output.writeByte(length);
            break;
        case 2:
            output.writeShort(length);
            break;
        case 3:
            high = length >> 16 & 255;
            low = length & 65535;
            output.writeByte(high);
            output.writeShort(low);
    }
    output.writeBytes(data, 0, length);
    return Buffer.from(output.buffer.toString("hex"), "hex");
};