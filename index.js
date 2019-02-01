const inquirer = require('inquirer');
const program = require('commander');
const colors = require('colors');
const https = require('https');
const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;
const spawn = require('child_process').spawn;

let team;

program
  .option('-t, --team [team]', 'bitbucket team name')
  .option('-a, --authentication [authentication]', 'bitbucket authentication in username:password format')
  // .option('-k, --key [key]', 'bitbucket project key')
  .parse(process.argv);

const request = function (options) {
  return new Promise((resolve, reject) => {
    console.log(`${colors.green(options.method)} to: https://${options.host}${options.path}`);
    const req = https.request(options, (response) => {
      if (response.statusCode < 200 || response.statusCode > 299) {
        reject(new Error('Failed to load page, status code: ' + response.statusCode));
      }
      const body = [];
      response.on('data', (chunk) => body.push(chunk));
      response.on('end', () => {
        let data = body.join('');
        try {
          data = JSON.parse(data);
        } catch (e) {
          console.log(colors.yellow('Unable to parse response to JSON'));
        }
        resolve(data);
      });
    });
    req.on('error', (err) => reject(err));
    req.end();
  });
};

function getProjects(credentials, page) {
  let url = `/2.0/teams/${team}/projects/`;
  if (page) {
    url += `?page=${page}`;
  }
  const options = {
    host: 'api.bitbucket.org',
    path: url,
    method: 'GET',
    auth: `${credentials.username}:${credentials.password}`
  };
  return request(options);
}

function getProject(credentials, key) {
  const options = {
    host: 'api.bitbucket.org',
    path: `/2.0/repositories/${team}?q=project.key="${key}"`,
    method: 'GET',
    auth: `${credentials.username}:${credentials.password}`
  };
  return request(options);
}

function mkDirInCwd(name) {
  return new Promise((resolve) => {
    fs.mkdir(path.join(process.cwd(), name), (err) => {
      if (err && err.code !== 'EEXIST') { throw err; }
      else resolve();
    });
  });
}

function compress(name, path) {
  var pathToArchive = `./${name}.tar.gz`;
  var pathToFolder = path;

  var tar = spawn('tar', ['czf', pathToArchive, pathToFolder]);
  tar.on('exit', function (code) {
    if (code === 0) {
      console.log(colors.green(`Team code compressed: ${colors.grey(pathToArchive)}`));
    } else {
      console.log(colors.red(`Failed to compress folder. Check that you have the 'tar' utility installed.`));
    }
  });
}

async function main() {
  let credentials;
  if (program.authentication) {
    const auth = program.authentication.split(':');
    credentials = {
      username: auth[0],
      password: auth[1]
    };
  } else {
    credentials = await inquirer.prompt([{
      type: 'input',
      name: 'team',
      message: 'Enter bitbucket team name',
      when: () => { return !program.team; }
    }, {
      type: 'input',
      name: 'username',
      message: 'Enter bitbucket username'
    }, {
      type: 'password',
      name: 'password',
      message: 'Enter bitbucket password'
    }]);
  }
  team = program.team || credentials.team;
  await mkDirInCwd(team);
  let projects = [];
  const projectsRes = await getProjects(credentials);
  projects = projectsRes.values;
  let numberOfPages = Math.ceil(projectsRes.size / projectsRes.pagelen);
  while (numberOfPages > 1) {
    const pageRes = await getProjects(credentials, numberOfPages);
    numberOfPages--;
    projects = projects.concat(pageRes.values);
  }

  for (let i = 0; i < projects.length; i++) {
    let project = projects[i];
    await mkDirInCwd(`${team}/${project.name}`);
    const projectRes = await getProject(credentials, project.key);
    for (let j = 0; j < projectRes.values.length; j++) {
      let repo = projectRes.values[j];
      await exec(`git clone https://${credentials.username}@bitbucket.org/${repo.full_name}.git`, { cwd: path.join(process.cwd(), team, project.name) }, (err, stdout, stderr) => {
        if (err) console.error(err);
        console.log(colors.gray(stderr));
      });
    }
  }

  compress(team, path.join(process.cwd(), team));
}

main();
