package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"strings"
	"time"
)

func main() {
	args := os.Args[1:]

	packageFileName := fmt.Sprintf("%s/package.json", args[0])
	packageJson, err := os.Open(packageFileName)
	if err != nil {
		log.Fatal(err)
	}

	packageBytes, err := ioutil.ReadAll(packageJson)
	if err != nil {
		log.Fatal(err)
	}

	var packageInfo map[string]interface{}
	json.Unmarshal(packageBytes, &packageInfo)

	originalVersion := fmt.Sprintf("%s", packageInfo["version"])
	nightlyVersion := fmt.Sprintf("%s-nightly.%s", strings.Split(originalVersion, "-")[0], time.Now().Format("20060102"))
	packageInfo["version"] = nightlyVersion

	newPackageJson := strings.Replace(string(packageBytes), originalVersion, nightlyVersion, 1)
	err = ioutil.WriteFile(packageFileName, []byte(newPackageJson), 0644)
	if err != nil {
		log.Fatal(err)
	}

	packageJson.Close()
	fmt.Println("Update package.json with version:", nightlyVersion)
}
