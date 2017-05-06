#!/usr/bin/env node

const kopy = require('kopy')
const fs = require('fs')
const path = require('path')
const Listr = require('listr')
const execa = require('execa')
const fetch = require('node-fetch')
const utils = require('./utils')

const name = process.argv[2]
const useYarn = utils.hasOption('yarn')
const skipPackageCheck = utils.hasOption('skip-check')
const skipGitInit = utils.hasOption('skip-git')

if (!name) {
  console.log('Please specify name of the package')
  process.exit(1)
}

const gitignore = path.resolve(__dirname, '../.gitignore')
const dest = path.resolve(process.cwd(), name)
const template = path.resolve(__dirname, '../template')

const tasks = new Listr([
  {
    title: 'Check for package existance',
    skip: () => skipPackageCheck,
    task: () => fetch(`http://registry.npmjs.org/${name}`)
      .then(response => {
        return response.json()
      })
      .then(packageInfo => {
        if (!packageInfo.name) {
          return
        }

        throw new Error(`${name} already exists https://www.npmjs.com/package/${name}`)
      })
  },
  {
    title: 'Get git global user information',
    task: ctx => utils.getGloablUserGit().then(response => ctx.gitUser = response)
  },
  {
    title: 'Drop package scaffold',
    task: ctx => kopy(template, dest, {
      data: {
        name: name,
        author: ctx.gitUser
      }
    })
  },
  {
    title: 'Install dependencies with Yarn',
    enabled: () => useYarn,
    task: () => {
      process.chdir(dest)
      return execa('yarn')
    }
  },
  {
    title: 'Install dependencies',
    enabled: () => !useYarn,
    task: () => {
      process.chdir(dest)
      return execa('npm', ['install'])
    }
  },
  {
    title: 'Initialize git',
    skip: () => skipGitInit,
    task: () => {
      const gitignoreContent = fs.readFileSync(gitignore, 'utf8')
      fs.writeFileSync(`${dest}/.gitignore`, gitignoreContent)
      return execa('git', ['init'])
    }
  }
])

tasks.run()
  .then(response => {
    console.log(`
    Npm package as been created successfully!

    Start coding:
      cd ${name} && npm run dev
    `)
  })
  .catch(() => {})