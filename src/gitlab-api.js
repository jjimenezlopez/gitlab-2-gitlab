/* globals module */

(function () {
    'use strict';

    var Promise = require('promise'),
        _ = require('underscore'),
        theOriginRepo,
        theDestinyRepo,
        originProjects,
        destinyProjects,
        originGitlab,
        destinyGitlab,
        publicMethods = {};

    publicMethods.setGitlabs = function (origin, destiny) {
        originGitlab = origin;
        destinyGitlab = destiny;
    };

    publicMethods.createDestinyProject = function (project) {
        return new Promise(function (resolve, reject) {
            destinyGitlab.projects.create(project, function (result) {
                if (result === true) {
                    console.log(' --- Project ' + project.name + ' already exists.');
                } else {
                    console.log(' --- Project ' + project.name + ' created.');
                }
                resolve(result);
            });
        });
    };

    publicMethods.copyIssues = function (originProject, destinyProject) {
        return new Promise(function (resolve, reject) {
            if (originProject.issues_enabled) {
                console.log(' ---- Getting issues...');
                var promises = [];

                originGitlab.projects.issues.list(originProject.id, function (issues) {
                    process.stdout.write(' ---- Copying');
                    _.each(issues, function (issue) {
                        promises.push(new Promise(function (resolve, reject) {
                            destinyGitlab.issues.create(destinyProject.id, issue, function (newIssue) {
                                if (newIssue !== true) {
                                    process.stdout.write('.');
                                    if (issue.state === 'closed') {
                                        process.stdout.write('C');
                                        destinyGitlab.issues.edit(destinyProject.id, newIssue.id, {state_event: 'close'}, function (value) {
                                            resolve();
                                        });
                                    } else {
                                        process.stdout.write('O');
                                        resolve();
                                    }
                                }
                            });
                        }));
                    });

                    Promise.all(promises)
                        .then(resolve)
                        .catch(function (err) {
                            reject(err);
                        });
                });
            } else {
                console.log(' ---- Issues disabled.');
            }
        });
    };

    publicMethods.migrateProject = function (projectId) {
        return new Promise(function (resolve, reject) {
            originGitlab.projects.show(projectId, function (project) {
                console.log(' -- Migrating project', project.name);
                publicMethods.createDestinyProject(project)
                    .then(function (destinyProject) {
                        var promise = Promise.resolve(destinyProject);

                        if (destinyProject === true) {
                            // already exists
                            promise = new Promise(function (resolve, reject) {
                                destinyGitlab.projects.all(function (projects) {
                                    _.each(projects, function (aProject) {
                                        if (project.name === aProject.name) {
                                            resolve(aProject);
                                        }
                                    });
                                });
                            });
                        }

                        return promise.then(function (destinyProject) {
                            return publicMethods.copyIssues(project, destinyProject);
                        });
                    })
                    .then(function () {
                        resolve();
                    })
                    .catch(function (err) {
                        console.log(err);
                    });
            });
        });
    };

    module.exports = publicMethods;
}());
