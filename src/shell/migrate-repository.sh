#!/bin/bash

ORIGIN=$1
ORIGIN_NAME=$2
DESTINY=$3

ACTUAL_PATH=`pwd`;

cd /tmp
git clone $ORIGIN $ORIGIN_NAME;
cd $ORIGIN_NAME;
git checkout master;
for remote in `git branch -r | grep -v master `; do git checkout --track $remote; done;
git remote set-url origin $DESTINY;
git push --all origin -u; git push --tags;

cd $ACTUAL_PATH;
