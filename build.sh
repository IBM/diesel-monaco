#!/bin/bash

yarn install && \
yarn --cwd monaco build && \
yarn --cwd sandbox build