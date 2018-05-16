const sqlite = require("sqlite");
const program = require('commander');
const fs = require('fs');
const { unserialize } = require('php-unserialize');

const VERSION = '1.0.1';

let databaseFile = '';
/** Define the tool syntax */
program
  .version(VERSION)
  .arguments('<database_file>')
  .action(arg => databaseFile = arg)
  .parse(process.argv);

/** Asserts that a existing filename was provided */
if (!fs.existsSync(databaseFile)) {
  console.error('no valid database file supplied'); 
  console.log(program.help());
  process.exit(1);
}

/** Promise factory for sqlite.open */
const dbPromise = (filename) => sqlite.open(filename, { Promise });

(async () => {
  try {
    const db = await dbPromise(databaseFile);
    const entries = await db.all('SELECT * FROM system;');
    const projectsInfo = entries.reduce((projects, moduleEntry) => {
      const moduleInfo = unserialize(moduleEntry.info);
      const { project, name, version } = moduleInfo;
      if (!project) {
        console.error(`NOTICE: Project "${name}" has no project defined - will be skipped.`);
        return projects;
      }
      /** Transform Drupal version string to composer format */
      let composerVersion;
      try {
        composerVersion = /7\.x-(.*)/.exec(version)[1];
      } catch(e) {
        composerVersion = version;
      }

      const composerProject = `drupal/${project}`;
      const projectObj = {};
      projectObj[composerProject] = `${composerVersion}`;
      /** Filter projects of Drupal itself and duplicated entries */
      if ( project !== 'drupal' && !projects.find(project => project.hasOwnProperty(composerProject) ) ) {
        projects.push(projectObj);
      }
      return projects;
    }, []).reduce((projects, project, index, originalProjects) => {
      const [[name, version],] = Object.entries(project);
      const lastComma = index === originalProjects.length -1 ? '' : ',';
      projects = projects + `"${name}" : "${version}"${lastComma}\n`;
      return projects;
    }, '');
    console.log(`\n Modules in composer format: \n \n${projectsInfo}`);
  } catch (e) {
    if (e.code) {
      console.log(e.message);
    }
    console.error('Failed to get the data.');
    process.exit(1);
  }
})();