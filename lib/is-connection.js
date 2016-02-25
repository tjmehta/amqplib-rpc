module.exports = isConnection

function isConnection (conn) {
  if (!conn || !conn.createChannel) {
    throw TypeError('"connection" must be an amqplib connection: http://www.squaremobius.net/amqp.node/channel_api.html#connect')
  }
}
