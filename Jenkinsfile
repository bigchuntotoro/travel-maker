pipeline {
    agent any

    tools {
        // Jenkins에 등록된 도구 이름에 맞게 수정하세요 (예: jdk17, nodejs 등)
        jdk 'JDK21'
        nodejs 'NodeJS24'
    }

    stages {
        stage('Checkout') {
            steps {
                // Git 저장소 소스 코드 체크아웃
                checkout scm
            }
        }

        stage('Build Frontend') {
            steps {
                dir('frontend') {
                    // 의존성 설치 및 React 빌드 (Vite 설정에 의해 빌드 결과물이 ../src/main/resources/static으로 출력됨)
                    sh 'npm install'
                    sh 'npm run build'
                }
            }
        }

        stage('Build Backend') {
            steps {
                // Gradle을 이용한 Spring Boot Executable JAR 빌드 (테스트 제외 시 -x test 추가 가능)
                sh './gradlew clean build -x test'
            }
        }

        stage('Deploy') {
            steps {
                // 기존에 실행 중인 Spring Boot 프로세스 종료 (필요 시 PID 확인 후 안전하게 종료)
                sh "pkill -f 'travel-maker.*\\.jar' || true"

                // 백그라운드로 Spring Boot 실행 (nohup 활용)
                sh "nohup java -jar build/libs/*.jar > ./app.log 2>&1 &"
            }
        }
    }

    post {
        success {
            echo 'Jenkins Build & Deploy Success!'
        }
        failure {
            echo 'Jenkins Build & Deploy Failed.'
        }
    }
}