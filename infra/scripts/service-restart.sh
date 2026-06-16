#!/bin/bash


repo="motacare"
branch="dev"
git_repo="https://github.com/Prodatek/motacare.git"

#for service teardown
cd $repo

docker compose down --rmi all

cd .. && rm -Rf $repo

git clone $git_repo && cd $repo

git switch $branch

cp ~/vagrant-data/newlinux-001/.env ~/vagrant-data/newlinux/$repo/.env


# for service pull up
docker compose up -d

echo "service restarted"

wait 1
docker compose ps

echo "done"
