## To develop with this version on babylonjs: ##


```
#!csh
git clone https://github.com/BabylonJS/Babylon.js.git
cd Tools/Gulp
npm install

```

* gulp typescript-all     … to build everything
* gulp webserver          … to start the server.  go to http://localhost:1338/localDev/index.html
* gulp run 		… to watch and rebuild and restart the server

Open the following file in a browser when the server is running:

http://localhost:1338/localDev/index.html

## To clone a copy of the babylonjs library (only), for usage: ##

```
#!csh

mkdir babylonjs
cd babylonjs
git init
git remote add origin https://lfung@bitbucket.org/lfung/babylon.js.git
git config core.sparseCheckout true
echo "dist/dataux release" >> .git/info/sparse-checkout
git pull --depth=1 origin master

```