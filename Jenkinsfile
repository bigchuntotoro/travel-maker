pipeline {
    agent any

    environment {
        // =================================================
        // 프로젝트 / 배포 경로 설정
        // =================================================
        TARGET_DIR      = '/home/totoro/Reactproject/travel-maker'
        APP_NAME        = 'travel-maker'

        FRONTEND_DIR    = "${WORKSPACE}/frontend"

        // Vite/React build 결과물이 임시로 위치하거나 복사될 경로
        // 보통 Vite 기본 빌드 결과물(dist 등)을 Spring static 폴더로 복사해야 합니다.
        // 프론트 빌드 output이 'dist'라면 아래와 같이 활용됩니다.
        FRONTEND_BUILD_DIR = "${WORKSPACE}/frontend/dist"
        STATIC_OUT_DIR  = "${WORKSPACE}/src/main/resources/static"

        // =================================================
        // 실행 환경
        // =================================================
        JAVA_HOME       = '/usr/lib/jvm/java-21-openjdk-amd64'
        APP_PORT        = '8084'

        PATH            = "/usr/local/bin:/usr/bin:/bin:${env.PATH}"
    }

    tools {
        jdk 'JDK21'
        nodejs 'NodeJS24'
    }

    stages {

        // =================================================
        // 1. 소스 체크아웃
        // =================================================
        stage('1. Checkout') {
            steps {
                checkout scm
                sh 'chmod +x gradlew'
            }
        }

        // =================================================
        // 2. React Frontend Build & Copy to Spring Boot
        // =================================================
        stage('2. Build Frontend (React - Vite)') {
            steps {
                dir("${FRONTEND_DIR}") {
                    sh """
                        set -e
                        echo "================================================="
                        echo "==> Checking Node / NPM"
                        echo "================================================="
                        node -v
                        npm -v

                        echo ""
                        echo "================================================="
                        echo "==> Installing NPM Dependencies"
                        echo "================================================="
                        if [ ! -d "node_modules" ]; then
                            npm ci --prefer-offline
                        else
                            npm ci --prefer-offline
                        fi

                        echo ""
                        echo "================================================="
                        echo "==> Building React Frontend"
                        echo "================================================="
                        npm run build
                    """
                }

                // React 빌드 결과물을 Spring Boot의 static 폴더로 복사 (통합 JAR 생성용)
                sh """
                    set -e
                    echo "================================================="
                    echo "==> Copying React Build to Spring Boot Static Dir"
                    echo "================================================="

                    mkdir -p "${STATIC_OUT_DIR}"

                    // 기존 static 내용 정리 후 복사 (dist 기준, 프론트 설정에 따라 build 등으로 바뀔 수 있음)
                    rm -rf "${STATIC_OUT_DIR}/*"
                    cp -r "${FRONTEND_BUILD_DIR}/." "${STATIC_OUT_DIR}/"

                    echo "==> Copied file list:"
                    ls -lah "${STATIC_OUT_DIR}"
                """
            }
        }

        // =================================================
        // 3. Spring Boot Gradle Build (통합 JAR 생성)
        // =================================================
        stage('3. Build Backend (Spring Boot / Gradle)') {
            steps {
                sh """
                    set -e
                    echo "================================================="
                    echo "==> Building Spring Boot Application with Gradle"
                    echo "================================================="

                    ./gradlew clean build -x test

                    echo ""
                    echo "==> build/libs directory:"
                    ls -lah build/libs/
                """
            }
        }

        // =================================================
        // 4. Deploy Backend JAR
        // =================================================
        stage('4. Deploy Backend JAR') {
            steps {
                sh """
                    set -e
                    echo "================================================="
                    echo "==> Preparing Spring Boot Deployment"
                    echo "================================================="

                    mkdir -p "${TARGET_DIR}"
                    mkdir -p "${TARGET_DIR}/logs"

                    BUILD_JAR=\$(find build/libs \\
                        -maxdepth 1 \\
                        -type f \\
                        -name "*.jar" \\
                        ! -name "*-sources.jar" \\
                        ! -name "*-plain.jar" \\
                        -print \\
                        | head -n 1)

                    if [ -z "\$BUILD_JAR" ]; then
                        echo "ERROR: Spring Boot JAR file not found."
                        exit 1
                    fi

                    echo "BUILD_JAR: \$BUILD_JAR"

                    cp -f "\$BUILD_JAR" "${TARGET_DIR}/${APP_NAME}.jar"
                    chmod 755 "${TARGET_DIR}/${APP_NAME}.jar"

                    echo "Deployment JAR: ${TARGET_DIR}/${APP_NAME}.jar"
                    ls -lah "${TARGET_DIR}/${APP_NAME}.jar"
                """
            }
        }

        // =================================================
        // 5. Run Spring Boot (Log & Background)
        // =================================================
        stage('5. Run Backend Application') {
            steps {
                sh """
                    set -e
                    echo "================================================="
                    echo "==> Starting Spring Boot Application"
                    echo "================================================="

                    // 기존 프로세스 안전 종료
                    pkill -f '${env.APP_NAME}.*\\.jar' || true
                    sleep 2

                    // 백그라운드 실행 및 로그 분리 저장 (backend-out.log / backend-error.log)
                    cd "${TARGET_DIR}"
                    nohup java -jar "${APP_NAME}.jar" > logs/backend-out.log 2> logs/backend-error.log &

                    echo "==> Waiting for Spring Boot to start..."
                    STARTED=false

                    for i in \$(seq 1 30); do
                        HTTP_CODE=\$(curl \\
                            -s \\
                            -o /dev/null \\
                            -w "%{http_code}" \\
                            --connect-timeout 1 \\
                            "http://127.0.0.1:${APP_PORT}/" \\
                            || true)

                        if [ "\$HTTP_CODE" != "000" ]; then
                            echo "Spring Boot responded with HTTP Status: \${HTTP_CODE}"
                            STARTED=true
                            break
                        fi

                        echo "--> Waiting... \${i}/30"
                        sleep 1
                    done

                    if [ "\$STARTED" != "true" ]; then
                        echo "ERROR: Spring Boot failed to start. Checking logs..."
                        tail -n 50 "${TARGET_DIR}/logs/backend-error.log" || true
                        exit 1
                    fi

                    echo "================================================="
                    echo "==> Backend Deployment Completed Successfully"
                    echo "================================================="
                """
            }
        }
    }

    // =====================================================
    // POST ACTIONS
    // =====================================================
    post {
        success {
            echo """
=================================================
Successfully deployed ${APP_NAME}!
=================================================
Application : ${APP_NAME}
Port        : ${APP_PORT}
Logs Path   : ${TARGET_DIR}/logs/
=================================================
"""
        }

        failure {
            echo """
=================================================
Deployment FAILED for ${APP_NAME}
=================================================
Check Jenkins console logs or error log files.
=================================================
"""
        }

        always {
            echo "==> Jenkins Pipeline Finished"
        }
    }
}