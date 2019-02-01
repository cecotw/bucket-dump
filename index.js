const inquirer = require('inquirer');
const program = require('commander');
const colors = require('colors');
const https = require('https');
const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;
const team = 'talladega';

program
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

function getProjects(credentials) {
  const options = {
    host: 'api.bitbucket.org',
    path: `/2.0/teams/${team}/projects/`,
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
    fs.mkdir(path.join(process.cwd, name), (err) => {
      if (err) throw err;
      else resolve();
    });
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
      name: 'username',
      message: 'Enter bitbucket username'
    }, {
      type: 'password',
      name: 'password',
      message: 'Enter bitbucket password'
    }]);
  }

  const projectsRes = await getProjects(credentials);
  await Promise.all(projectsRes.values.map(async project => {
    console.log(project);
    // await mkDirInCwd(project.name);
    // const projectRes = await getProject(credentials, project.key);
    // projectRes.values.forEach(async project => {
    //   await exec(`git clone https://${credentials.username}@bitbucket.org/${project.full_name}.git`, { cwd: program.projectDirectory }, (err, stdout, stderr) => {
    //     if (err) console.err(err);
    //     console.log(colors.gray(stderr));
    //   });
    // });
  }));
  // const projectPrompt = await inquirer.prompt([{
  //   type: 'list',
  //   name: 'project',
  //   message: 'Select project',
  //   choices: projectsRes.values.map(p => {
  //     return { name: p.name, value: p };
  //   })
  // }]);
  // key = projectPrompt.project.key;
  // const projectRes = await getProject(credentials, key);
  // projectRes.values.forEach(async project => {
  //   await exec(`git clone https://${credentials.username}@bitbucket.org/${project.full_name}.git`, { cwd: program.projectDirectory }, (err, stdout, stderr) => {
  //     console.log(colors.gray(stderr));
  //   });
  // });
}

main();
