import url from 'node:url';
import path from 'node:path'
import os from "node:os"

import fastify from 'fastify'
import fastifyStatic from "@fastify/static"
import websocket from "@fastify/websocket"
import si from "systeminformation"

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const app = await fastify()

await app.register(websocket)

await app.register(fastifyStatic, {
  root: path.join(__dirname, "..", 'public'),
  prefix: '/public/', // optional: default '/'
})

function transformBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

app.get("/cpu", async (_, reply) => {
  const { manufacturer, brand, speed, socket, flags, virtualization, cores, physicalCores, cache } = await si.cpu();

  const cpu = {
    manufacturer,
    brand,
    baseClock: speed,
    socket: socket.length > 0 ? socket : null,
    instructions: flags,
    virtualization,
    cores: physicalCores,
    threads: cores - physicalCores,
    cache: {
      l1: transformBytes(cache.l1d),
      l2: transformBytes(cache.l2),
      l3: transformBytes(cache.l3),
    }
  }
  
  return reply.send(cpu)
})

app.get('/', (req, reply) => {
  return reply.sendFile('index.html')
})

function cpuAverage() {
  const cpus = os.cpus(); // Called on every check to refresh CPU data

  // The amount of time the computer has spent in each mode since last reboot
  let idleMs = 0; // The aggregate total of all cores idle in milliseconds
  let totalMs = 0;

  // loop through each core
  cpus.forEach((cpu) => {
    for (const type in cpu.times) {
      totalMs += cpu.times[type];
    }
    
    idleMs += cpu.times.idle;
  });

  return {
    idle: idleMs / cpus.length,
    total: totalMs / cpus.length,
  };
}

function getCpuLoad(time = 100) {
  return new Promise((resolve) => {
    const start = cpuAverage();

    const id = setTimeout(() => {
      const end = cpuAverage();
      const idleDifference = end.idle - start.idle;
      const totalDifference = end.total - start.total;
      
      const percentageCpu = 100 - Math.floor((100 * idleDifference) / totalDifference);

      clearTimeout(id)
      resolve(percentageCpu);
    }, time);
  });
}

app.get('/websocket', { websocket: true }, async (connection, req) => {
  // connection.socket.on('message', message => {
    //   // message.toString() === 'hi from client'
    //   console.log(message.toString())
    //   connection.socket.send('hi from server')
    // })

  let id
  
  id = setInterval(async () => {
    // cpu
    const cpuLoad = await getCpuLoad();
    const { main } = await si.cpuTemperature()
    
    // https://github.dev/adele-angel/system-monitor/tree/master/node-files
    
    const data = {
      // cpu
      cpuLoad,
      cpuTemp: main
    }
    
    connection.socket.send(JSON.stringify(data))
  }, 300)

  connection.socket.on('close', () => {
    console.log("closed connection")
    clearInterval(id)
  })
})

// fastify.get('/another/patch-async', async function (req, reply) {
//   return reply.sendFile('myHtml.html')
// })

// fastify.get('/path/with/different/root', function (req, reply) {
//   reply.sendFile('myHtml.html', path.join(__dirname, 'build')) // serving a file from a different root location
// })

// fastify.get('/another/path', function (req, reply) {
//   reply.sendFile('myHtml.html', { cacheControl: false }) // overriding the options disabling cache-control headers
// })

app.listen({ port: 3000 }, (err, address) => {
  if (err) throw err
  console.log(`Server is now listening on ${address}`)
})
// import { WebSocketServer } from "ws"

// const wss = new WebSocketServer({
//   port: 8080
// });

// const onError = (error) => {
//   console.log("failed")
//   console.error(error)
// }

// const onMessage = (data) => {
//   console.log('received: %s', data);
// }

// const connection = (websocket) => {
//   websocket.on('error', onError);
  
//   websocket.on('message', onMessage);
//   // websocket.send('something');
// }

// wss.on('connection', connection);