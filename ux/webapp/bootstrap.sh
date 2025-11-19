#
# I used this script to bootstrap the react web app
# to note that I run this script from the root directory of the project
# moved it here to have it near all the react files
#

set -x

#create a new react app
docker run --rm -w /src -v $(pwd):/src node:22 npm install create-react-app
docker run --rm -w /src -v $(pwd)/ux:/src node:22 npx create-react-app .
