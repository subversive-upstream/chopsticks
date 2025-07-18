// generated by polka.codes
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import { glob } from 'glob'
import semver from 'semver'

const getPackageJsonPaths = async () => {
  const rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
  const workspaces = rootPkg.workspaces
  const packageJsonPaths = []
  for (const workspace of workspaces) {
    const paths = await glob(`${workspace}/package.json`)
    packageJsonPaths.push(...paths)
  }
  return packageJsonPaths
}

const main = async () => {
  // Pre-flight checks
  execSync('git fetch')
  // 1. Check for clean working directory
  const gitStatus = execSync('git status --porcelain').toString()
  if (gitStatus) {
    console.error('Error: Git working directory is not clean. Please commit or stash your changes.')
    process.exit(1)
  }

  // 2. Check if on master branch and up-to-date
  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim()
  if (currentBranch !== 'master') {
    console.error('Error: Not on master branch. Please switch to master branch to release.')
    process.exit(1)
  }
  const local = execSync('git rev-parse @').toString().trim()
  const remote = execSync('git rev-parse @{u}').toString().trim()
  if (local !== remote) {
    console.error('Error: Local branch is not up-to-date with remote. Please pull changes.')
    process.exit(1)
  }

  // Determine new version
  const mainPackageJsonPath = 'packages/chopsticks/package.json' // Assuming this is the main package
  const mainPackageJson = JSON.parse(fs.readFileSync(mainPackageJsonPath, 'utf-8'))
  const currentVersion = mainPackageJson.version

  let newVersion = process.argv[2]

  if (!newVersion) {
    newVersion = semver.inc(currentVersion, 'patch')
    console.log(`Version not specified, using next patch version: ${newVersion}`)
  } else {
    newVersion = semver.clean(newVersion)
  }

  if (!semver.valid(newVersion)) {
    console.error(`Error: Invalid version: ${newVersion}`)
    process.exit(1)
  }

  if (!semver.gt(newVersion, currentVersion)) {
    console.error(`Error: New version ${newVersion} is not greater than current version ${currentVersion}`)
    process.exit(1)
  }

  console.log(`Releasing version ${newVersion}...`)

  const packageJsonPaths = await getPackageJsonPaths()

  // Update versions in all package.json files
  const allPackagePaths = [...packageJsonPaths, 'package.json']
  for (const packageJsonPath of allPackagePaths) {
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf-8')
    const packageJson = JSON.parse(packageJsonContent)

    // update package version, if it has one
    if (packageJson.version) {
      packageJson.version = newVersion
      fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, '\t')}\n`)
    }
  }

  // Git operations
  console.log('Committing and pushing changes...')
  execSync('yarn') // run yarn to update lock file
  execSync('git add .')
  const commitMessage = `chore: release ${newVersion}`
  execSync(`git commit -m "${commitMessage}"`)
  execSync(`git tag ${newVersion}`)
  execSync('git push')
  execSync('git push --tags')

  console.log(`Successfully released version ${newVersion}!`)
}

main().catch((error) => {
  console.error('An error occurred during the release process:', error)
  process.exit(1)
})
