pipeline {
    agent any

    environment {
        // =================================================
        // 프로젝트 / 배포 경로 설정
        // =================================================
        TARGET_DIR      = '/home/totoro/Reactproject/travel-maker'
        APP_NAME        = 'travel-maker'
        SERVICE_NAME    = 'travel-maker'

        // 사용자 컨텍스트 반영: frontend는 프로젝트 root에 위치
        FRONTEND_DIR    = "${WORKSPACE}/frontend"
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
        // 2. React Frontend Build & Copy to Spring Boot Static
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
                        npm ci --prefer-offline

                        echo ""
                        echo "================================================="
                        echo "==> Building React Frontend"
                        echo "================================================="
                        npm run build
                    """
                }

                // Vite 빌드 결과물(dist 등)을 Spring Boot static 경로로 복사
                sh """
                    set -e
                    echo "================================================="
                    echo "==> Copying Frontend Build to Spring Boot Static"
                    echo "================================================="

                    mkdir -p "${STATIC_OUT_DIR}"

                    # Vite 기본 빌드 결과물 디렉터리(dist) 안의 내용물들을 static으로 이동
                    if [ -d "${FRONTEND_DIR}/dist" ]; then
                        rm -rf "${STATIC_OUT_DIR}/*"
                        cp -r "${FRONTEND_DIR}/dist/." "${STATIC_OUT_DIR}/"
                    else
                        echo "ERROR: Frontend dist directory not found."
                        exit 1
                    fi

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
        // 5. Run Spring Boot via systemd & Health/DB Check
        // =================================================
        stage('5. Run & Verify Application') {
            steps {
                sh """
                    set -e
                    echo "================================================="
                    echo "==> Restarting Spring Boot Service via systemd"
                    echo "================================================="

                    sudo systemctl restart ${SERVICE_NAME}

                    echo "==> Waiting for Spring Boot & DB connection..."
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

                        echo "--> Waiting for server response... \${i}/30"
                        sleep 1
                    done

                    if [ "\$STARTED" != "true" ]; then
                        echo "ERROR: Spring Boot failed to start. Checking systemd logs..."
                        sudo journalctl -u ${SERVICE_NAME} -n 50 --no-pager || true
                        exit 1
                    fi

                    echo "================================================="
                    echo "==> Verifying Database Connection via Logs"
                    echo "================================================="
                    RECENT_LOGS=\$(sudo journalctl -u ${SERVICE_NAME} -n 30 --no-pager)

                    if echo "\$RECENT_LOGS" | grep -E -i "HikariPool.*Exception|Communications link failure|Access denied|Connection refused"; then
                        echo "ERROR: Database connection error detected in logs!"
                        exit 1
                    else
                        echo "SUCCESS: No database connection errors found in recent logs."
                    fi

                    echo "================================================="
                    echo "==> Backend Deployment & DB Check Completed Successfully"
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
Successfully deployed and verified ${APP_NAME}!
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
Deployment or DB Check FAILED for ${APP_NAME}
=================================================
Check Jenkins console logs or systemd logs.
=================================================
"""
        }

        always {
            echo "==> Jenkins Pipeline Finished"
        }
    }
}