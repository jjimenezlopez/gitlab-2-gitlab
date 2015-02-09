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
        methods = {

            setGitlabs: function (origin, destiny) {
                originGitlab = origin;
                destinyGitlab = destiny;
            },

            createDestinyProject: function (project) {
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
            },

            getLabels: function (project) {
                return new Promise(function (resolve) {
                    originGitlab.projects.labels.all(project.id, function (labels) {
                        resolve(labels);
                    });
                });
            },

            createLabel: function (label, project) {
                return new Promise(function (resolve) {
                    destinyGitlab.labels.create(project.id, label, function () {
                        resolve();
                    });
                });
            },

            createLabels: function (labels, project) {
                var me = this,
                    promises = [];

                _.each(labels, function (label) {
                    promises.push(me.createLabel(label, project));
                });

                return Promise.all(promises)
                .catch(function (err) {
                    console.log(err);
                });
            },

            getIssues: function (project) {
                return new Promise(function (resolve) {
                    originGitlab.projects.issues.list(project.id, function (issues) {
                        resolve(issues);
                    });
                });
            },

            getNotes: function (project, issue) {
                return new Promise(function (resolve) {
                    originGitlab.projects.issues.notes.all(project.id, issue.id, function (notes) {
                        resolve(notes);
                    });
                });
            },

            closeIssue: function (destinyProject, newIssue) {
                return new Promise(function (resolve) {
                    destinyGitlab.issues.edit(destinyProject.id, newIssue.id, {state_event: 'close'}, function () {
                        resolve();
                    });
                });
            },

            createNote: function (projectId, note, issueId) {
                var newNote = {
                    body: note.body
                };

                return new Promise(function (resolve) {
                    // when an issue is closed, gitlab creates a note with the text
                    // '_Status changed to closed_', so we want to skip this one.
                    if (newNote.body !== '_Status changed to closed_') {
                        destinyGitlab.notes.create(projectId, issueId, newNote, function () {
                            resolve();
                        });
                    } else {
                        resolve();
                    }
                });
            },

            createIssue: function (issue, originProject, destinyProject) {
                var me = this;

                return new Promise(function (resolve, reject) {
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
                            var promise;

                            process.stdout.write('.');
                            if (issue.state === 'closed') {
                                process.stdout.write('C');
                                promise = me.closeIssue(destinyProject, newIssue);
                            } else {
                                process.stdout.write('O');
                                promise = Promise.resolve();
                            }

                            promise.then(function () {
                                return me.getNotes(originProject, issue);
                            })
                            .then(function (notes) {
                                var promises = [];

                                // create notes
                                _.each(notes, function (note) {
                                    promises.push(me.createNote(destinyProject.id, note, newIssue.id));
                                });

                                return Promise.all(promises);
                            })
                            .then(function () {
                                resolve();
                            })
                            .catch(reject);
                        } else {
                            resolve();
                        }
                    });
                });
            },

            copyIssues: function (originProject, destinyProject) {
                var me = this;

                return new Promise(function (resolve, reject) {
                    if (originProject.issues_enabled) {
                        console.log(' ---- Getting issues...');
                        var promises = [];

                        me.getIssues(originProject)
                            .then(function (issues) {
                                var sequence = Promise.resolve();

                                if (issues.length) {
                                    process.stdout.write(' ---- Copying');
                                    _.each(issues, function (issue) {
                                        sequence = sequence.then(function () {
                                            return me.createIssue(issue, originProject, destinyProject)
                                        });
                                    });
                                } else {
                                    process.stdout.write(' ---- No issues to copy');
                                }

                                return sequence;
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
            },

            migrateProject: function (projectId) {
                var me = this,
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
                            return me.clone
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
            }

        };

    module.exports = methods;
}());
