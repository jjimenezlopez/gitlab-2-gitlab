var Promise = require('promise'),
    readline = require('readline'),
    _ = require('underscore'),
    gitlab = require('gitlab'),
    util = require('util'),
    gitlabApi = require('./gitlab-api'),
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
            console.error('You must provide all requested data.');
            process.exit();
        }
    })
    .then(function () {
        originGitlab = gitlab({
            url: originRepo,
            token: originToken
        });

        destinyGitlab = gitlab({
            url:   destinyRepo,
            token: destinyToken
        });

        gitlabApi.setGitlabs(originGitlab, destinyGitlab);

        return new Promise(function (resolve, reject) {
            console.log('Getting projects from', originRepo);
            originGitlab.projects.all(function (projects) {
                resolve(projects);
            });
        });

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
        var promises = [];

        console.log('Working...');
        _.each(numbers, function (number) {
            promises.push(gitlabApi.migrateProject(number));
        });

        return Promise.all(promises);
    })
    .then(function () {
        console.log('Migration finished!');
    })
    .catch(function (err) {
        console.log(err);
    });
