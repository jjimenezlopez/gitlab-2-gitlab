/* global -Promise */

var Promise = require('promise'),
    readline = require('readline'),
    _ = require('underscore'),
    util = require('util'),
    gitlabApi = require('./gitlab-api'),
    colors = require('colors'),
    originRepo,
    destinyRepo,
    originToken,
    destinyToken,
    originProjects,
    originProjectsFn,
    rl;

function getUserData(message) {
    return new Promise(function (resolve, reject) {
        rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question(message, function (value) {
            resolve(value);
            rl.close();
        });
    });
}

getUserData('Origin Gitlab URL: ')
    .then(function (value) {
        originRepo = value;
        return getUserData('Origin Gitlab private token: ');
    })
    .then(function (value) {
        originToken = value;
        return getUserData('Destiny Gitlab URL: ');
    })
    .then(function (value) {
        destinyRepo = value;
        return getUserData('Destiny Gitlab private token: ');
    })
    .then(function (value) {
        destinyToken = value;
    })
    .then(function () {
        if (!originRepo || !originToken || !destinyRepo || !destinyToken) {
            console.log('You must provide all requested data.'.red);
            process.exit();
        }
    })
    .then(function () {

        gitlabApi.setOrigin(originRepo, originToken);
        gitlabApi.setDestiny(destinyRepo, destinyToken);

        return gitlabApi.getOriginProjects();

    })
    .then(function (projects) {
        var i = 1;
        console.log('');

        originProjects = projects;

        _.each(originProjects, function (project) {
            console.log('\t' + project.id + '. ' + project.name);
            i++;
        });

        return getUserData('\nPlease, write the numbers of the projects you want to migrate (separated by comma) or ALL for all the projects: ');
    })
    .then(function (projectsNumbers) {
        var tempProjects,
            listProjects = [];

        if (projectsNumbers.indexOf('ALL') === 0) {
            _.each(originProjects, function (project) {
                listProjects.push(parseInt(project.id));
            });
        } else {
            tempProjects = projectsNumbers.replace(/ /g, '').split(',');

            _.each(tempProjects, function (number) {
                listProjects.push(parseInt(number));
            });
        }

        return listProjects;
    })
    .then(function (numbers) {
        var promises = [],
            sequence = Promise.resolve();

        console.log('Working...'.yellow);
        _.each(numbers, function (number) {
            sequence = sequence.then(function () {
                return gitlabApi.migrateProject(number);
            });
        });

        return sequence;
    })
    .then(function () {
        console.log('\nMigration finished!'.green);
    })
    .catch(function (err) {
        console.log(colors.red(err));
    });
