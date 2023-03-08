const Docker = require('dockerode');
const Readable = require('stream').Readable;

const docker = new Docker();

docker.createImage({ fromImage: 'ubuntu:latest' }).then(async (stream) => {
  console.log('Creating image...');
  await new Promise((resolve, reject) => {
    docker.modem.followProgress(stream, (err) => (err ? reject(err) : resolve()));
  });
  console.log('Image created');

  const container = await docker.createContainer({
    Image: 'ubuntu',
    OpenStdin: true,
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    StdinOnce: true,
    HostConfig: {
      AutoRemove: true,
    },
    Entrypoint: 'cat',
  });

  const attachStream = await container.attach({
    stream: true,
    stdin: true,
    stdout: true,
    stderr: true,
  });

  container.modem.demuxStream(attachStream, process.stdout, process.stderr);

  await container.start();

  const readable = new Readable();
  readable._read = () => {};
  readable.pipe(attachStream);

  await new Promise((resolve) => setTimeout(resolve, 500));
  readable.push('Hello world!\n');

  await new Promise((resolve) => setTimeout(resolve, 500));
  readable.push('Goodbye world!\n');

  await new Promise((resolve) => setTimeout(resolve, 500));
  readable.push(null);

  await container.wait();
});
