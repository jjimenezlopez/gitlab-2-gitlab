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
        methods = {};

    methods.setGitlabs = function (origin, destiny) {
        originGitlab = origin;
        destinyGitlab = destiny;
    };

    methods.createDestinyProject = function (project) {
        return new Promise(function (resolve) {
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

    methods.getLabels = function (project) {
        return new Promise(function (resolve) {
            originGitlab.projects.labels.all(project.id, function (labels) {
                resolve(labels);
            });
        });
    };

    methods.createLabel = function (label, project) {
        return new Promise(function (resolve) {
            destinyGitlab.labels.create(project.id, label, function () {
                resolve();
            });
        });
    };

    methods.createLabels = function (labels, project) {
        var me = methods,
            promises = [];

        _.each(labels, function (label) {
            promises.push(me.createLabel(label, project));
        });

        return Promise.all(promises)
            .catch(function (err) {
                console.log(err);
            });
    };

    methods.getIssues = function (project) {
        return new Promise(function (resolve) {
            originGitlab.projects.issues.list(project.id, function (issues) {
                resolve(issues);
            });
        });
    };

    methods.createIssue = function (issue, destinyProject) {
        return new Promise(function (resolve) {
            var data = {
                title: issue.title,
                description: issue.description,
                labels: ''
            };

            _.each(issue.labels, function (label) {
                data.labels = label + ',';
            });

            destinyGitlab.issues.create(destinyProject.id, data, function (newIssue) {
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
                } else {
                    resolve();
                }
            });
        });
    };

    methods.copyIssues = function (originProject, destinyProject) {
        var me = methods;

        return new Promise(function (resolve, reject) {
            if (originProject.issues_enabled) {
                console.log(' ---- Getting issues...');
                var promises = [];

                me.getIssues(originProject)
                    .then(function (issues) {
                        if (issues.length) {
                            process.stdout.write(' ---- Copying');
                            _.each(issues, function (issue) {
                                promises.push(me.createIssue(issue, destinyProject));
                            });
                        } else {
                            process.stdout.write(' ---- No issues to copy');
                        }

                        return Promise.all(promises);
                    })
                    .then(resolve)
                    .catch(function (err) {
                        console.log(err);
                        reject(err);
                    });
            } else {
                console.log(' ---- Issues disabled.');
                resolve();
            }
        });
    };

    methods.migrateProject = function (projectId) {
        var me = methods,
            destinyProject,
            originProject;

        return new Promise(function (resolve, reject) {
            originGitlab.projects.show(projectId, function (project) {
                console.log(' -- Migrating project', project.name);
                originProject = project;
                me.createDestinyProject(project)
                    .then(function (theProject) {
                        var promise = Promise.resolve(theProject);

                        if (theProject === true) {
                            // already exists
                            promise = new Promise(function (resolvePromise) {
                                destinyGitlab.projects.all(function (projects) {
                                    var existentProject;

                                    _.each(projects, function (aProject) {
                                        if (project.name === aProject.name) {
                                            existentProject = aProject;
                                        }
                                    });

                                    resolvePromise(existentProject);
                                });
                            });
                        }

                        return promise;
                    })
                    .then(function (project) {
                        destinyProject = project;
                    })
                    .then(function () {
                        return me.getLabels(originProject);
                    })
                    .then(function (labels) {
                        return me.createLabels(labels, destinyProject);
                    })
                    .then(function () {
                        return me.copyIssues(originProject, destinyProject);
                    })
                    .then(function () {
                        console.log('\n --- ' + project.name + ' migrated!');
                        resolve();
                    })
                    .catch(function (err) {
                        console.log(err);
                        reject(err);
                    });
            });
        });
    };

    module.exports = methods;
}());
