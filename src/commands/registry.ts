'use strict';

const { setupProject } = require('../setup');
const { showMenu } = require('../menu');
const { runManagedService, startDevelopment } = require('./dev');
const { installAll } = require('./install');
const { runForServices } = require('./tasks');
const { cleanProject } = require('./clean');
const { stopServices } = require('./stop');
const { restartServices } = require('./restart');
const { showLogs } = require('./logs');
const { doctor } = require('./doctor');
const { updateProject } = require('./update');
const { upgradeDevPilot } = require('./upgrade');
const { showAbout } = require('./about');
const { openDirectory, openInEditor } = require('./open');
const { showStatus } = require('./status');
const { showInfo } = require('./info');
const { listWorkspaceProfiles, manageProfile } = require('./profiles');

const commands = [
  {
    name: 'setup',
    description: 'Configure the current project',
    aliases: ['init'],
    requiresContext: false,
    handler: setupProject
  },
  {
    name: 'menu',
    description: 'Open the interactive menu',
    hidden: true,
    handler: (context, args, runCommand) => showMenu(context, runCommand)
  },
  {
    name: '__run-service',
    description: 'Run one managed service',
    hidden: true,
    handler: runManagedService
  },
  {
    name: 'dev',
    description: 'Start all configured services',
    profileMode: 'strict',
    handler: startDevelopment
  },
  {
    name: 'install',
    description: 'Install dependencies for all services',
    profileMode: 'strict',
    handler: installAll
  },
  {
    name: 'build',
    description: 'Build all services',
    profileMode: 'strict',
    handler: (context) => runForServices(context, 'build', 'Build All Services')
  },
  {
    name: 'lint',
    description: 'Lint all services',
    profileMode: 'strict',
    handler: (context) => runForServices(context, 'lint', 'Lint All Services')
  },
  {
    name: 'open',
    description: 'Open the project or a service in your file manager',
    profileMode: 'strict',
    handler: openDirectory
  },
  {
    name: 'code',
    description: 'Open the project or a service in your editor',
    profileMode: 'strict',
    handler: openInEditor
  },
  {
    name: 'clean',
    description: 'Remove generated folders',
    profileMode: 'strict',
    handler: cleanProject
  },
  {
    name: 'status',
    description: 'Show workspace service status',
    profileMode: 'strict',
    handler: showStatus
  },
  {
    name: 'stop',
    description: 'Stop DevPilot-managed services',
    profileMode: 'target',
    handler: stopServices
  },
  {
    name: 'restart',
    description: 'Restart DevPilot-managed services',
    profileMode: 'target',
    handler: restartServices
  },
  {
    name: 'logs',
    description: 'Show logs for DevPilot-managed services',
    profileMode: 'target',
    handler: showLogs
  },
  {
    name: 'info',
    description: 'Show workspace intelligence summary',
    profileMode: 'strict',
    handler: showInfo
  },
  {
    name: 'doctor',
    description: 'Check local tooling and workspace configuration',
    profileMode: 'strict',
    handler: doctor
  },
  {
    name: 'update',
    description: 'Pull latest changes and install dependencies',
    profileMode: 'strict',
    handler: updateProject
  },
  {
    name: 'profiles',
    description: 'List workspace profiles',
    handler: listWorkspaceProfiles
  },
  {
    name: 'profile',
    description: 'Create, edit, or delete workspace profiles',
    handler: manageProfile
  },
  {
    name: 'upgrade',
    description: 'Update the DevPilot CLI',
    aliases: ['self-update', 'selfupdate'],
    requiresContext: false,
    handler: upgradeDevPilot
  },
  {
    name: 'about',
    description: 'Show CLI and workspace information',
    handler: showAbout
  }
];

function findCommand(name) {
  return commands.find((command) => (
    command.name === name || (command.aliases || []).includes(name)
  ));
}

function visibleCommands() {
  return commands.filter((command) => !command.hidden);
}

module.exports = { commands, findCommand, visibleCommands };
