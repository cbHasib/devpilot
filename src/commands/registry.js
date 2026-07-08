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
const { showAbout } = require('./about');
const { openDirectory, openInEditor } = require('./open');
const { showStatus } = require('./status');
const { showInfo } = require('./info');

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
    handler: startDevelopment
  },
  {
    name: 'install',
    description: 'Install dependencies for all services',
    handler: installAll
  },
  {
    name: 'build',
    description: 'Build all services',
    handler: (context) => runForServices(context, 'build', 'Build All Services')
  },
  {
    name: 'lint',
    description: 'Lint all services',
    handler: (context) => runForServices(context, 'lint', 'Lint All Services')
  },
  {
    name: 'open',
    description: 'Open the project or a service in your file manager',
    handler: openDirectory
  },
  {
    name: 'code',
    description: 'Open the project or a service in your editor',
    handler: openInEditor
  },
  {
    name: 'clean',
    description: 'Remove generated folders',
    handler: cleanProject
  },
  {
    name: 'status',
    description: 'Show workspace service status',
    handler: showStatus
  },
  {
    name: 'stop',
    description: 'Stop DevPilot-managed services',
    handler: stopServices
  },
  {
    name: 'restart',
    description: 'Restart DevPilot-managed services',
    handler: restartServices
  },
  {
    name: 'logs',
    description: 'Show logs for DevPilot-managed services',
    handler: showLogs
  },
  {
    name: 'info',
    description: 'Show workspace intelligence summary',
    handler: showInfo
  },
  {
    name: 'doctor',
    description: 'Check local tooling and workspace configuration',
    handler: doctor
  },
  {
    name: 'update',
    description: 'Pull latest changes and install dependencies',
    handler: updateProject
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
